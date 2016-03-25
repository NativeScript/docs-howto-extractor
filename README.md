# SnippetsExtractor

This tool would extract snippets from source fiels.

## How to Mark a Snippet

You need to follow these rules:
 - Create a fully-functional unit-test that would contain your snippet.
 - Start snippet with `// <snippet module="<module-relative-path>" title="<snippet-title>" />`
    (module is the relative path of the module. Based on this path, a HowTo.md file
    will be generated. Title is the string, used to display the link in the generated
    documentation Table of Contents as well as the Description of the generated HTML file,
    read by the Search Engines.
 - Write md tags and comments by placing comment in the code file with // at the beginning.
 - You must wrap the code within md tags that would indicate it is actually a code.
    + Start with: // ``` JavaScript
    + To output a comment here start with ////, two of them would be automatically removed.
    + Hide asserts within `// <hide>` and `// </hide>`.
    + End with: // ```
 - End with `// </snippet>`

### Example:
``` JavaScript
exports.testFolderRename = function (){
    // <snippet filepath="ui/button" name="UI -> Button">
    // ## Setting a variable
    // This example shows how to initialize myVar to 15.
    // ``` JavaScript
    //// Setting myVar to 15.
    var myVar = 15;
    // <hide>
    console.assert(myVar == 15);
    // </hide>
    // ```
    // That's how you set a myVar to 15.
    // </snippet>
}
```

**START OF SET-VAR.MD**
## Setting a variable
This example shows how to initialize myVar to 15.
``` JavaScript
// Setting myVar to 15.
var myVar = 15;
```
That's how you set a myVar to 15.

**END OF SET-VAR.MD**

## How Does it Work
The tool is node.js console application.

When run it will clean up its destination folder from md files.
Then scan the source filder for js files.
Each js file will be searched for some special comments described below.
When comments that mark a snippet are found the tool
would output an md in the destination folder.

Check the help.md for command line options.

### Snippet tags
Snippet are enclosed within the tags:
``` JavaScript
// <snippet module="<module-path>" title="<module-title>">
    // This appends to <module-path>/HOW-TO.md
    var myVar;
// </snippet>
```
The lines between these two tags are appended to a file
with the name in the opening tag.

### Hide tags
To hide code, that should not show in the snippet, wrap it with:
``` JavaScript
// <hide>
// This comment and the assert below are ignored.
console.assert(myvar == "myvalue");
// </hide>
```

### Comment Slashes
When comments within snippets are found, two of the leading slashes will be removed.
``` JavaScript
// ## This is H2 header
//// Setting myVar
var myVar = 15
```

Would output the md:
``` JavaScript
## This is H2 header
// Setting myVar
var myVar = 15
```

### Leading whitespace
Uniform leading whitespace would be removed so the snippet text is left aligned.
So there is no problem to use identation in your code. However it must be
eiter tabs or spaces. Do not mix tabs and spaces within the same snippet.

### Can not Handle Comments with /* and */