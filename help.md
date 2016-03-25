## Summary

SnippetsExtractor is a simple tool that would extract code snipets from
JavaScript files and generate md documentation files.

## Command line options:

 -help

  Prints this wonderful documentation.

 -source <source-folder>

  Sets the source folder to search for .js files.
  By default the current directory would be used.

 -source-files-regex <regex>

  Sets a JavaScript regex used to filter source files to process.
  This is regex so multiple source extensions could be supported.
  Defaut is "\.js$"

 -destination <destination-folder>

  Sets the destination folder, where md files will be created.
  By default "snippets" inside the current directory would be used.

 -destination-files-extension <regex>

  Sets a target file extension string. This is NOT a regex.
  If cleaning is performed all files with that extension from the destionation folder
  will be deleted. Then if the destination folder is not empty the execution would fail.
  Defaut is "md".
