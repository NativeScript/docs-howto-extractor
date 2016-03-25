/* tslint:disable */
import fs = require("fs");
import path = require("path");

interface ExtractorSettings {
    sourceDir: string;
    destinationDir: string;
    sourceFilesRegex: string;
    destinationFilesExtension: string;
    noclean: boolean;
    logger: (message: string) => void;
    snippetFinder: SnippetFinder;
}

interface Snippet {
    title: string;
    moduleName: string;
    line: number;
    content: string;
}

interface SnippetHeader {
    title: string;
    moduleName: string;
}

interface SnippetFinder {
    process(content: string): Snippet[];
}

class JavaScriptSnippets implements SnippetFinder {

    private sourceLines: string[];

    private hide: boolean;
    private snippetTitle = null;
    private snippetModule = null;
    private snippetLineNumber = 0;
    private snippetLines: string[];
    private snippets: Snippet[];

    private currentLineNumber: number;
    private currentLineText: string;

    public process(content: string): Snippet[] {

        this.sourceLines = content.split("\n");
        this.resetState();
        this.snippets = new Array<Snippet>();

        this.processLines();

        var temp = this.snippets;

        this.sourceLines = null;
        this.resetState();
        this.snippets = null;

        return temp;
    }

    private resetState() {
        this.hide = false;
        this.snippetTitle = null;
        this.snippetLineNumber = 0;
        this.snippetLines = null;
    }

    private processLines() {
        this.sourceLines.forEach((line, index, lines) => {
            this.currentLineText = line;
            this.currentLineNumber = index;
            this.processLine();
        });
    }

    private processLine() {
        // This is not a banana, it is an inlined automat.
        // TODO: Full blown automat with error detection for misclosed tags.
        if (this.snippetTitle) {
            this.processOutputLine();
        } else {
            this.waitSnippetStart();
        }
    }

    private processOutputLine() {
        if (this.isAtSnippetEndTag) {
            this.completeSnippet();
        } else {
            if (this.hide) {
                if (this.isAtHideEndTag) {
                    this.hide = false;
                }
            } else {
                if (this.isAtHideStartTag) {
                    this.hide = true;
                } else {
                    this.snippetLines.push(this.currentLineText);
                }
            }
        }
    }

    private waitSnippetStart() {
        var snippetHeader = this.extractSnippetHeader(this.currentLineText);
        if (snippetHeader != null) {
            this.snippetTitle = snippetHeader.title;
            this.snippetModule = snippetHeader.moduleName;
            this.snippetLineNumber = this.currentLineNumber;
            this.snippetLines = new Array<string>();
        }
    }

    private extractSnippetHeader(line: string): SnippetHeader {
        var tagNameChecker = /\s*\/\/\s*<snippet\s*/;
        var startsAsSnippetTag = tagNameChecker.test(line);

        if (!startsAsSnippetTag) {
            return null;
        }

        var restOfLine = line.replace(tagNameChecker, "");

        var attributeNameAndValueExtractor = /(\b)(([\w\d]+)=('|")([^\1]*?))\4/;
        var entireStringSearched = false;

        var snippetHeader: SnippetHeader = <SnippetHeader>{};
        while (!entireStringSearched)
        {
            var nextAttribute = attributeNameAndValueExtractor.exec(restOfLine);
            if (nextAttribute == null) {
                entireStringSearched = true;
            } else {
                // TODO: Extract to a separate method:
                var attrName = nextAttribute[3];
                var attrValue = nextAttribute[5];

                // We got a tag with unknown attributes!
                if (attrName != "module" && attrName != "title") {
                    throw new Error("Invalid snippet attribute '" + attrName + "'!");
                    return null;
                }
                restOfLine = restOfLine.substring(restOfLine.indexOf(nextAttribute[0]) + nextAttribute[0].length);

                // The module attribute is a special common-script keyword, hence
                //  special handling is needed:
                if (attrName == "module") {
                    attrName = "moduleName";
                }
                snippetHeader[attrName] = attrValue;
            }
        }

        if (this.isNullOrUndefined(snippetHeader.title) ||
            this.isNullOrUndefined(snippetHeader.moduleName)) {
            throw new Error("Either path or module attribute of snippet not defined");
        }
        return snippetHeader;
    }

    private isNullOrUndefined(obj) {
        return typeof (obj) == "undefined" || obj == null;
    }

    private completeSnippet() {
        this.trimInitialWhiteSpace();
        this.trimCommentSlashes();
        this.pushSnippet();
        this.resetState();
    }

    private trimInitialWhiteSpace() {
        var ident = 0;
        if (this.snippetLines.length > 0) {
            var allWhiteSpace = true;
            var hasMoreCharacters = false;
            do {
                this.snippetLines.forEach((line, index, lines) => {
                    if (line.length > ident) {
                        hasMoreCharacters = true;
                        if (!line.charAt(ident).match("\\s")) {
                            allWhiteSpace = false;
                        }
                    }
                });
                if (allWhiteSpace && hasMoreCharacters) {
                    ident++;
                }
            } while (allWhiteSpace && hasMoreCharacters);
        }
        this.snippetLines = this.snippetLines.map((line, index, lines) => line.substring(ident));
    }

    private trimCommentSlashes() {
        this.snippetLines = this.snippetLines.map((line, index, lines) => {
            var commentMatch = line.match(/^(\s*)\/\/\s?(.*)/m);
            if (commentMatch && commentMatch.length > 2) {
                return commentMatch[1] + commentMatch[2];
            } else {
                return line;
            }
        });
    }

    private pushSnippet() {
        var snippetString = this.snippetLines.join("\n");
        this.snippets.push(<Snippet> { content: snippetString, title: this.snippetTitle, moduleName: this.snippetModule, line: this.snippetLineNumber });
    }

    private get isAtSnippetEndTag(): boolean {
        return this.currentLineText.match("^\\s*//\\s*\\</snippet\\>\\s*$") != null;
    }

    private get isAtHideEndTag(): boolean {
        return this.currentLineText.match("^\\s*//\\s*\\</hide\\>\\s*$") != null;
    }

    private get isAtHideStartTag(): boolean {
        return this.currentLineText.match("^\\s*//\\s*\\<hide\\>\\s*$") != null;
    }
}

class Extractor {

    private sourceDir: string;
    private destinationDir: string;
    private sourceFiles: string;
    private destinationFilesExtension: string;
    private noclean: boolean;
    private logger: (message: string) => void;

    private snippetFinder: SnippetFinder;

    constructor(settings: ExtractorSettings) {
        this.sourceDir = settings.sourceDir;
        this.destinationDir = settings.destinationDir;
        this.sourceFiles = settings.sourceFilesRegex;
        this.destinationFilesExtension = settings.destinationFilesExtension;
        this.noclean = settings.noclean;
        this.logger = settings.logger;

        this.snippetFinder = settings.snippetFinder;
    }

    public extract() {
        this.setupDestination();
        this.extractFromSourceFiles();
    }

    private log(message: string) {
        if (this.logger) this.logger(message);
    }

    private setupDestination() {
        this.cleanUpDestination();
        this.createDestinationDir();
    }

    private cleanUpDestination() {
        if (this.destinationDirExists && !this.noclean) {
            this.log("Cleaning up destination directory.");
            this.cleanDestinationMDFiles();
            this.removeDestinationDir();
        }
    }

    private get destinationDirExists() : boolean {
        return fs.existsSync(this.destinationDir);
    }

    private cleanDestinationMDFiles() {
        this.desintaionFiles.forEach((file, index, array) => {
            this.log("  Remove file: " + file);
            fs.unlinkSync(this.destinationDir + "\\" + file);
        });
    }

    private get desintaionFiles(): string[]{
        var ext = this.destinationFilesExtension;
        return fs.readdirSync(this.destinationDir).filter((file, index, array) => {
            return file.length > ext.length && file.substr(file.length - ext.length - 1) == ("." + ext);
        });
    }

    private removeDestinationDir() {
        this.log("Remove destination directory.");
        fs.rmdirSync(this.destinationDir);
    }

    private createDestinationDir() {
        if (!this.destinationDirExists) {
            this.log("Creating directory: " + this.destinationDir);
            fs.mkdirSync(this.destinationDir);
        }
    }

    private extractFromSourceFiles() {
        this.log("Scanning files:");
        var files = this.getSourceFiles().forEach((file, index, files) => this.extractFromFile(file));
    }

    private getSourceFiles(): string[]{
        var formattedSourceDir = this.ensureEndingSlash(this.sourceDir);
        var allfiles = this.getDirRecursiveSync(formattedSourceDir);
        return allfiles.filter((file, index, array) => file.match(this.sourceFiles) != null);
    }

    private ensureEndingSlash(path: string): string {
        if (/\/$/.test(path)) {
            return path;
        }
        return path + "/";
    }

    private getDirRecursiveSync(dir: string, filelist?: string[]): string[]{
        var files = fs.readdirSync(dir);
        filelist = filelist || [];
        var fileLength = files.length;
        for (var i = 0; i < fileLength; i++) {
            var file = files[i];
            var path = dir + file;
            if (fs.statSync(path).isDirectory()) {
                filelist = this.getDirRecursiveSync(this.ensureEndingSlash(path), filelist);
            } else {
                filelist.push(path);
            }
        }
        return filelist;
    }

    private extractFromFile(file: string) {
        this.log(" * " + file);
        var filePath = file;
        var content = fs.readFileSync(filePath).toString();
        var snippets = this.snippetFinder.process(content);
        snippets.forEach((snippet, index, snippets) => {
            console.log("    - " + snippet.line + ": " + snippet.moduleName);
            var outputPath = this.destinationDir + "/" + snippet.moduleName + "/" + "HOW-TO." + this.destinationFilesExtension;
            var titles = snippet.content.match(new RegExp("^\\s*#.*$", "mg"));
            if (titles) {
                titles.forEach((title) => {
                    console.log("            " + title);
                });
            }
            var dirPath = path.dirname(outputPath);
            if (!fs.existsSync(dirPath)) {
                //                fs.mkdirSync(dirPath);
                this.makeDirRecursive(dirPath);
            }
            if (!fs.existsSync(outputPath)) {
                this.addHeaderToFile(outputPath, snippet.title);
            }
            fs.appendFileSync(outputPath, snippet.content + "\n", { encoding: "UTF-8" });
        });
    }

    private makeDirRecursive(dirPath: string) {
        if (fs.existsSync(dirPath)) {
            return;
        }
        else {
            this.makeDirRecursive(path.dirname(dirPath));
            fs.mkdirSync(dirPath);
        }
    }

    private addHeaderToFile(filePath: string, snippetTitle: string) {
        var header = this.getHeader(snippetTitle);
        fs.appendFileSync(filePath, header, { encoding: "UTF-8" });
    }

    private getHeader(snippetTitle: string): string {
        return "---\n" +
            "nav-title: \"" + snippetTitle + " How-To\"\n" +
            "title: \"How-To\"\n" +
            "description: \"Examples for using " + snippetTitle + "\"\n" +
            "---\n";
    }
}

interface ArgsSettings {
    args: string[];
    flags: { [name: string]: boolean };
    parameters: { [name: string]: string };
}

class CommandLineArgsParser {

    private settings: ArgsSettings;

    constructor(settings: ArgsSettings) {
        // TODO: Perhaps we need to deep copy this as json. Currently the behavior is destructive.
        this.settings = settings;

        var switches: { [name: string]: boolean } = {};
        var expectsParam: string = null;
        settings.args.forEach((arg, index, args) => {
            if (expectsParam) {
                this.settings.parameters[expectsParam] = arg;
                expectsParam = null;
            } else if (typeof this.settings.flags[arg] !== "undefined") {
                if (switches[arg]) {
                    throw new Error("Duplicate flag " + arg + ".");
                }
                switches[arg] = true;
                this.settings.flags[arg] = !this.settings.flags[arg];
            } else if (typeof this.settings.parameters[arg] !== "undefined") {
                if (switches[arg]) {
                    throw new Error("Duplicate parameter " + arg + ".");
                }
                switches[arg] = true;
                expectsParam = arg;
            } else {
                throw new Error("Unexpected argument " + arg + ".");
            }
        });
        if (expectsParam) {
            throw new Error("Expected value for param " + expectsParam + ".");
        }
    }

    public flag(name: string): boolean {
        return this.settings.flags[name];
    }

    public param(name: string): string {
        return this.settings.parameters[name];
    }

    public get length(): number {
        return this.settings.args.length;
    }
}

interface TocBuilderSettings {
    directory: string;
    extension: string;
}

class TocBuilder {

    private directory: string;
    private extension: string;
    private logger: (string) => void;

    constructor(settings: TocBuilderSettings) {
        this.directory = settings.directory;
        this.extension = settings.extension;
    }

    public build() {
        console.log("Building 'Table of Contents'.");
        var dotExt = "." + this.extension;

        var dir = this.directory;
        fs.readdirSync(this.directory).forEach((file) => {
            var filePath = dir + "\\" + file;
            if (filePath.length >= dotExt.length && filePath.substring(filePath.length - dotExt.length) == dotExt) {
                console.log(" * " + file);
                var content = fs.readFileSync(filePath).toString();

                var toc = "";
                var headingLineMatch = /^\s*(#+)\s*(.*)/mg;
                var match = headingLineMatch.exec(content);
                while (match != null) {
                    console.log("     " + match[0]);
                    var heading = "";
                    var hStrength = match[1].length;
                    for (var i = 0; i < hStrength - 1; i++) {
                        heading += "  ";
                    }
                    var title = match[2];
                    heading += "- [" + title + "](#" + title.toLowerCase().replace(/\s/g, '-') + ")\n";
                    toc += heading;

                    match = headingLineMatch.exec(content);
                }
                toc += "\n";
                fs.writeFileSync(filePath, toc + content, { encoding: "UTF-8" });
            }
        });
    }
}

try {

    var arguments = process.argv.slice(2);

    var args = new CommandLineArgsParser({
        args: arguments,
        flags: {
            "-help": false,
            "-noclean": false
        },
        parameters: {
            "-source": "",
            "-source-files-regex": "\\.js$",
            "-destination": "snippets",
            "-destination-files-extension": "md",
        }
    });

    if (args.length == 0) {
        console.log(fs.readFileSync("help.md").toString());
    } else if (args.flag("-help")) {
        if (args.length == 1) {
            console.log(fs.readFileSync("help.md").toString());
        } else {
            throw new Error("Unexpected -help option.");
        }
    } else {

        new Extractor({
            sourceDir: args.param("-source"),
            destinationDir: args.param("-destination"),
            sourceFilesRegex: args.param("-source-files-regex"),
            destinationFilesExtension: args.param("-destination-files-extension"),
            noclean: args.flag("-noclean"),

            logger: (m) => console.log(m),
            snippetFinder: new JavaScriptSnippets()
        }).extract();

        new TocBuilder({
            directory: args.param("-destination"),
            extension: args.param("-destination-files-extension")
        }).build();

        console.log("Success.");
    }

} catch (error) {
    console.log("ERROR: " + error.toString());
}
