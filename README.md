# eleventy-plugin-pandoc

A plugin for Eleventy that swaps out the markdown-it renderer
for Pandoc. (Made because I was integrating Eleventy with a
larger project already using Pandoc for generating PDFs, and
it's helpful to have one consistent Markdown renderer instead
of trying to sync up functionality between the two of them.)

Initiate like most Eleventy plugins:
```js
const md = require("./src/11ty_mods/customMarkdown");
module.exports = function(eleventyConfig) {
  md(eleventyConfig, options);
}
```

`options` keys:
* `inputFormat`: will be passed to Pandoc to specify exactly
   what flavor of Markdown you're using. Examples: `commonmark`, `gfm`,
   `markdown_strict`, `markdown+implicit_header_references`. Heck, if
   you want to use djot or creole or something, have it. 
   [Pandoc gives you options](https://pandoc.org/MANUAL.html#option--from).
   (default: `commonmark`)
* `outputFormat`: Default is `html` and that's definitely what Eleventy
   is expecting, but you can override if for some reason you want
   something else.
* `pathToPandoc`: will try to run just plain "pandoc" as the command,
   so it needs to be on your path somewhere. If you need to specify
   the location of the binary more directly, set this option.
* `pandocInvoke`: can be either `server` or `direct` (default).
  * If it's set to `server`, an instance of Pandoc will start at the
    beginning of the build and be shut down at the end. Markdown
    rendering will be done by the server. (This option is 
    [a bit more limited](https://github.com/jgm/pandoc/blob/master/doc/pandoc-server.md)
    but runs substantially faster if you have a large set of content.)
  * If set to `direct` a new instance of Pandoc will be invoked for each
    file to be rendered. This can take the 
    [full suite of Pandoc options](https://pandoc.org/MANUAL.html), 
    Lua filters, etc.
* `pandocOptions`:
   * If you're running directly, this should be an array that will
     be passed as arguments to the command line. Example: `["--section-divs",
     "--highlight-style", "monochrome"]`
   * If you're running as a server, this should be an
     object that includes all the keys that will be passed as options to
     the server. Example: `{"section-divs": true, "highlight-style": "monochrome"}`
   * Finally, it can also be a function (non-async, sorry) that returns the
     appropriate array or object. The function will receive the renderer 
     environment as its argument. 
* `pandocServerStartupWait`: how long in milliseconds to wait for the server
   to be ready before asking it to render. Experimentally `200`, the default,
   seems to work, but make this longer if you're getting errors.
* `pandocServerPort`: the server will start up on port 3030 by default, but
   you can override as needed.

I don't **love** how this works... I would much rather use the commented-out
approach at the end of the file, but that loses the template processing of
the Markdown prior to rendering. There has to be better way, but I haven't gotten
traction on it [when I asked on the Eleventy project](https://github.com/11ty/eleventy/discussions/3381).
