const child_process = require("child_process");
const http = require("http");
const deasync = require("deasync");

function sleep(ms) {
  let done = false;
  setTimeout(() => { done = true; }, ms);
  deasync.loopWhile(() => !done);
}

function fetchSync(url, data) {
  const encodedData = JSON.stringify(data);
  const urlObj = new URL(url);
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 80,
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(encodedData)
    }
  };

  let responseText = '';
  let error = null;
  let done = false;

  const req = http.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      responseText += chunk;
    });
    res.on('end', () => {
      done = true;
    });
  });

  req.on('error', (e) => {
    error = e;
    done = true;
  });

  req.write(encodedData);
  req.end();

  deasync.loopWhile(() => !done);

  if (error) {
    throw error;
  }

  return responseText;
}

module.exports = (eleventyConfig, options = {}) => {
  let pandocProc = null;

  const config = {
    inputFormat: "commonmark",
    outputFormat: "html",
    pandocInvoke: "direct",
    pathToPandoc: "pandoc",
    pandocOptions: undefined,
    pandocServerStartupWait: 200,
    pandocServerPort: 3030,
  }

  Object.assign(config, options);

  // Dummy extension of the "md" file format; without a `compile` function
  //   it will fall back to the built-in template engine.
  // This is just so the log label indicates that there's some
  //   custom stuff happening.
  eleventyConfig.addExtension("md", {
    name: "pandoc-md"
  });

  eleventyConfig.on("eleventy.before",
    async ({ dir, results, runMode, outputMode }) => {
      if (config.pandocInvoke == "server") {
        console.log("Starting Pandoc server...");
        pandocProc = child_process.spawn(config.pathToPandoc, [
          "server",
          "--port", config.pandocServerPort.toString()]
        );
        sleep(config.pandocServerStartupWait);
      }
    }
  );

  eleventyConfig.on("eleventy.after",
    async ({ dir, results, runMode, outputMode }) => {
      if (config.pandocInvoke == "server") {
        if (pandocProc != null) {
          console.log("Shutting down Pandoc server...");
          pandocProc.kill();
        }
      }
    }
  );

  // The dirty business of monkey-patching.
  eleventyConfig.amendLibrary("md", (lib) => {
    lib.render = (src, env) => {
      if (config.pandocInvoke == "direct") {
        let pandocOpts = config.pandocOptions ?? [];
        if (typeof pandocOpts === "function") {
          pandocOpts = pandocOpts(env);
        }
        if (!Array.isArray(pandocOpts)) {
          throw new Error(`Expected array for "pandocOptions", got ${typeof config.pandocOptions}.`)
        }
        const params = [
          "--from", config.inputFormat,
          "--to", config.outputFormat,
        ].concat(pandocOpts);
        const output = child_process.spawnSync(config.pathToPandoc,
          params, {input: src}
        );
        if (output.status != 0) {
          console.error(`PANDOC ERROR: ${output.stderr}`);
          return;
        }
        return output.stdout.toString("utf8");
      }
      else if (config.pandocInvoke == "server") {
        let pandocOpts = config.pandocOptions ?? {};
        if (typeof pandocOpts === "function") {
          pandocOpts = pandocOpts(env);
        }
        if (typeof pandocOpts != "object") {
          throw new Error(`Expected object for "pandocOptions", got ${typeof pandocOpts}.`)
        }
        const params = Object.assign({
          text: src,
          from: config.inputFormat,
          to: config.outputFormat,
        }, pandocOpts);

        try {
          const response = fetchSync(`http://localhost:${config.pandocServerPort}`, params);
          return response;
        }
        catch (error) {
          console.error(error);
        }
      }
      else {
        throw new Error('Invalid Pandoc invocation method; must be either "server" or "direct".');
      }
    }
  });
};


// This was the original, much simpler attempt at doing Pandoc rendering
//   I would still very much prefer to do something like this, since it
//   integrates better with Eleventy's expected tweaking system and doesn't
//   involve monkey-patching a third-party library. BUT, there's no way to
//   override the handling of "md" **and** still use template syntax in
//   Markdown files. (I [opened a discussion about this on the Eleventy
//   project](https://github.com/11ty/eleventy/discussions/3381),
//   but got no traction. 😢)
//
// ```js
// eleventyConfig.addExtension("md", {
//   name: "pandoc-md",
//   compile: function(inputContent, inputPath) {
//     return async function(data) {
//       const proc = child_process.spawn("pandoc", [
//         "--from", "markdown+implicit_header_references",
//         "--to", "html",
//         "--wrap", "none"
//       ]);
//
//       proc.stdin.write(inputContent);
//       proc.stdin.end();
//
//       let output = "";
//       for await (const chunk of proc.stdout) {
//         output += chunk;
//       }
//       let err = "";
//       for await (const chunk of proc.stderr) {
//         err += chunk;
//       }
//       const exitCode = await new Promise( (resolve, reject) => {
//         proc.on('close', resolve);
//       });
//
//       if (exitCode != 0) {
//         console.error(`PANDOC ERROR: ${err}`);
//         return;
//       }
//
//       return output;
//
//       // return this.defaultRenderer(data);
//     }
//   }
// });
// ```
