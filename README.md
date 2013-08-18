# grunt-task-helper

taskHelper helps selecting files for other tasks.  
For example, you want to minify only changed JS files. Then taskHelper selects files which are newer than `dest` from `src` (or newer than the time when this ran last time), and these files are passed to [Uglify](https://npmjs.org/package/grunt-contrib-uglify) task.

And, taskHelper helps you do something small to files (or file's contents).  
For example, rename file, replace text, etc...  
You can create your custom task to do something easily via `grunt.registerTask()`. Or, writing new plugin is easy too. Using taskHelper is more easy.

## Getting Started
This plugin requires Grunt `~0.4.1`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-task-helper --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-task-helper');
```

## taskHelper task
taskHelper accepts standard Grunt `files` components (see [Files](http://gruntjs.com/configuring-tasks#files)) and one or more [*handlers*](#handlers).  
The handler is a *JavaScript Function* which you wrote, or a name of [builtin handler](#builtin-handlers). These handlers are called in some timings to select files or do something to files or file's contents. If you want, taskHelper creates standard Grunt `files` components which are new for other tasks.

### Overview
In your project's Gruntfile, add a section named `taskHelper` to the data object passed into `grunt.initConfig()` (see [Configuring tasks](http://gruntjs.com/configuring-tasks)).  
You specify the `files` and one or more [*handlers*](#handlers) (e.g. `options.handlerByFile`). taskHelper accepts these all files, and some files are selected or done something via handler, and only selected files (filtered files) are passed to other tasks via `options.filesArray`.

Examples:

+ Copy only CSS files which are needed. This handler works like expanded [Custom Filter Function](http://gruntjs.com/configuring-tasks#custom-filter-function).

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFileSrc: function(src, dest, options) {
          if (/^(.+)\.css$/.test(src)) {

            // CSS file from SCSS file is not needed.
            if (grunt.file.exists(RegExp.$1 + '.scss'))
              { return false; }

            // Give priority to souces directory.
            var filepath = src.replace(/^develop/, 'souces');
            if (grunt.file.exists(filepath)) { return filepath; }
          }
        },
        filesArray: []
      },
      src: 'develop/**/*.{css,scss}',
      dest: 'backup/'
    }
  },
  copy: {
    deploy: {
      // Copy files which are selected via taskHelper.
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

+ Minify only changed JS files. (see [Builtin handler "newFile"](#builtin-handlers-newfile).)

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        // Select files which are newer than `dest`.
        handlerByFile: 'newFile',
        filesArray: []
      },
      expand: true,
      cwd: 'develop/',
      src: '**/*.js',
      dest: 'public_html/'
    }
  },
  uglify: {
    deploy: {
      // Minify files which are selected via taskHelper.
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

+ Insert menu navigation into HTML files.

`Gruntfile.js`

```js
var htmlMenu = grunt.file.read('../menu.html');
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByContent: function(contentSrc, options) {
          // Insert HTML content to placeholder.
          return contentSrc.replace(/<%MENU%>/, htmlMenu);
        }
      },
      expand: true,
      cwd: 'develop/',
      src: '**/*.html',
      dest: 'public_html/'
    }
  }
});
```

### <a name ="handlers">Handlers</a>
taskHelper parses `files` components, and calls handlers at four timings. The flow may be changed by return value of handlers.  
You can specify *JavaScript Function* which you wrote, or a name of [builtin handler](#builtin-handlers). If you want, you can specify multiple handlers into a timing by specifying array of these.

Below are timings which call handlers, and how to specify each handlers.

#### handlerByTask
The handlers which were specified via `options.handlerByTask` are called per a task(target) before `files` components are parsed. This may be a handler, or an array which includes multiple handlers. (see [Cycle of handlers](#cycle-handlers).)  
If *JavaScript Function* is specified, following arguments are assigned, and return value is the following meaning.

```js
handlerByTask(options)
```

+ <strong>`options` Type: Object</strong>  
Copy of `options` which is passed to `grunt.initConfig()`.

+ <strong>Return value</strong>  
If the handler returns `false`, exit current task immediately, and the remaining handlers are not called.  
*NOTE:* Any value except `false` (e.g. `undefined` or returns with *no value*) is ignored. i.e. it means the same as `return true`.

Example:

`Gruntfile.js`

```js
grunt.initConfig({
  // Configuring httpd.
  concat: {
    setup: {
      src: ['/lib/httpd/common.conf', 'httpd/project.conf'],
      dest: '/etc/httpd/conf/httpd.conf'
    }
  },
  taskHelper: {
    setup: {
      options: {
        handlerByTask: function(options) {
          // Restart httpd.
          var exec = require('child_process').exec;
          exec('service node-httpd restart',
            function (error, stdout, stderr) {
                console.log('stdout: ' + stdout);
                console.log('stderr: ' + stderr);
                if (error !== null)
                  { console.log('exec error: ' + error); }
            }
          );
        }
      }
    }
  }
});
```

#### handlerByFileSrc
The handlers which were specified via `options.handlerByFileSrc` are called per a `src` file in specified `files` components (and parsed by Grunt). This may be a handler, or an array which includes multiple handlers. (see [Cycle of handlers](#cycle-handlers).)  
If *JavaScript Function* is specified, following arguments are assigned, and return value is the following meaning.

```js
handlerByFileSrc(src, dest, options)
```

+ <strong>`src` Type: String</strong>  
The file path of a `src` file in specified `files` components. This was parsed by Grunt, therefore [Globbing patterns](http://gruntjs.com/configuring-tasks#globbing-patterns) (e.g. `foo/*.js`) which was specified to `src` became real path that was found (e.g. `foo/file-1.js`).  
If `src` includes multiple files (e.g. array of files, or files `file-1.js` and `file-2.js` which was found via globbing pattern `*.js`), all handlers in `handlerByFileSrc` are called with an assigned first file in `src`, and these handlers are called with an assigned second file, and continue next. (see [Cycle of handlers](#cycle-handlers).) Note that this flow may be changed by handler. (see Return value below.)

+ <strong>`dest` Type: String</strong>  
The file path of a `dest` file in specified `files` components.

+ <strong>`options` Type: Object</strong>  
Copy of `options` which is passed to `grunt.initConfig()`.

+ <strong>Return value</strong>  
If the handler returns `false`, remove current file path from `src`, and the remaining handlers in `handlerByFileSrc` are not called. This is like a `filter` (see [Custom Filter Function](http://gruntjs.com/configuring-tasks#custom-filter-function)). If other tasks will take these selected files (filtered files), an Array must be specified to `options.filesArray`. taskHelper adds `files` components to this array, and you let other task refer to this array.  
*NOTE:* Any value except `false` (e.g. `undefined` or returns with *no value*) is ignored. i.e. it means the same as `return true`.  
If the handler returns String, the current `src` file path is replaced with this String. Note that other task may ignore the `src` file which doesn't exist.

Example:

`Gruntfile.js`

```js
var cssFiles = [ {
    src: 'theme-base/css/base.css',
    dest: 'public_html/css/base.css'
  } ],
  path = require('path');
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFileSrc: function(src, dest, options) {
          if (/^(.+?)\.test(\.css)$/.test(path.basename(src))) {
            var newSrc = 'theme-dark/css/' + RegExp.$1 + RegExp.$2;
            return grunt.file.exists(newSrc) ?
              newSrc :  // Change theme to dark.
              false;    // Exclude this.
          }
        },
        filesArray: cssFiles
      },
      expand: true,
      cwd: 'develop/',
      src: '**/*.css',
      dest: 'public_html/'
    }
  },
  cssmin: {
    deploy: {
      files: cssFiles
    }
  }
});
```

#### handlerByFile
The handlers which were specified via `options.handlerByFile` are called per an element in specified `files` components (and parsed by Grunt, and might have changed by `handlerByFileSrc`). This may be a handler, or an array which includes multiple handlers. (see [Cycle of handlers](#cycle-handlers).)  
If *JavaScript Function* is specified, following arguments are assigned, and return value is the following meaning.

```js
handlerByFile(srcArray, dest, options)
```

+ <strong>`srcArray` Type: Array</strong>  
The array which includes the file path of `src` files in specified `files` components. This was parsed by Grunt, therefore [Globbing patterns](http://gruntjs.com/configuring-tasks#globbing-patterns) (e.g. `foo/*.js`) which was specified to `src` became real path that was found (e.g. `foo/file-1.js`). And, these might have changed by handlers in `handlerByFileSrc`. (see above.)  
If `src` is a file path (e.g. String `'foo/file.js'`), this array includes an element (e.g. Array `['foo/file.js']`). If `src` files were all not found, array is empty.

+ <strong>`dest` Type: String</strong>  
The file path of a `dest` file in specified `files` components.

+ <strong>`options` Type: Object</strong>  
Copy of `options` which is passed to `grunt.initConfig()`.

+ <strong>Return value</strong>  
If the handler returns `false`, remove current element from `files` components, and the remaining handlers in `handlerByFile` are not called. If other tasks will take these selected files (filtered files), an Array must be specified to `options.filesArray`. taskHelper adds `files` components to this array, and you let other task refer to this array.  
*NOTE:* Any value except `false` (e.g. `undefined` or returns with *no value*) is ignored. i.e. it means the same as `return true`.  
If the handler returns String, the current `dest` file path is replaced with this String.

Example:

`Gruntfile.js`

```js
var path = require('path');
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFile: function(srcArray, dest, options) {
          if (!srcArray.length) {
            // Exclude this.
            return false;
          } else if (srcArray.length > 1) {
            // Multiple photos in a page.
            return path.dirname(dest) + '/thumbnails.html';
          }
        },
        filesArray: []
      },
      files: [
        {
          src: 'public_html/jon/photos/*.jpg',
          dest: 'public_html/jon/photos/photo.html'
        },
        {
          src: 'public_html/kim/photos/*.jpg',
          dest: 'public_html/kim/photos/photo.html'
        }
      ]
    }
  },
  makeGallery: {
    deploy: {
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

#### handlerByContent
The handlers which were specified via `options.handlerByContent` are called per a `dest` file in specified `files` components (and parsed by Grunt, and might have changed by `handlerByFileSrc`). This may be a handler, or an array which includes multiple handlers. (see [Cycle of handlers](#cycle-handlers).)  
These are handlers to edit (or check) the content that should be written to `dest` file.  
If *JavaScript Function* is specified, following arguments are assigned, and return value is the following meaning.

```js
handlerByContent(contentSrc, options)
```

+ <strong>`contentSrc` Type: String</strong>  
The current `src` file's contents to first handler. To remaining handlers, the text which returned by previous handler.  
All current `src` files (which were parsed by Grunt, and might have changed by `handlerByFileSrc`) are loaded, and these concatenated contents is passed to first handler. The text which was returned via the end handler is written to `dest` file.

+ <strong>`options` Type: Object</strong>  
Copy of `options` which is passed to `grunt.initConfig()`.

+ <strong>Return value</strong>  
This value is passed to next handler. The end handler returns value to write to `dest` file.  
If the handler returns `false`, the remaining handlers in `handlerByContent` are not called, and `dest` file is done nothing.  
*NOTE:* Any value except `false` (e.g. `undefined` or returns with *no value*) is content. i.e. if nothing was returned, empty text is written to `dest` file.

##### `options.separator`
All contents of current `src` files are concatenated with `options.separator`. For example, *line-break-character* `\n` can be specified.  
If this option was not specified, taskHelper uses *line-break-character* which was found first in current `src` file's contents. If that was not found, `grunt.util.linefeed` is used.

Priority Order:

1. `options.separator`
2. line-break-character in `src` file's contents (found first)
3. `grunt.util.linefeed`

*NOTE:* `grunt.util.linefeed` is chosen via operating system which executes this task. Not operating system which uses the generated files. If this task is executed on Windows, `\n` for others will be specified to `options.separator` or `src` files may include this.

Example:

`Gruntfile.js`

```js
var htmlMenu = grunt.file.read('../menu.html');
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByContent: [
          // 1st handler
          function(contentSrc, options) {
            // Insert HTML content to placeholder.
            return contentSrc.replace(/<%MENU%>/, htmlMenu);
          },
          // End handler
          function(contentSrc, options) {
            if (/<h2\b.*?>(.+?)<\/h2>/.test(contentSrc)) {
              // Content title
              var pageTitle = RegExp.$1;
              // Style menu item of current page.
              // (a part of HTML inserted by 1st handler)
              return contentSrc.replace(
                new RegExp('<li class="menu-item">(?=' + pageTitle + ')'),
                '<li class="menu-item current">');
            } else return contentSrc;
          }
        ]
      },
      expand: true,
      cwd: 'develop/',
      src: '**/*.html',
      dest: 'public_html/'
    }
  }
});
```

### <a name ="cycle-handlers">Cycle of handlers</a>
The handlers are called at four timings as follows unless it is aborted by returning false.

```
---------------------------------- <Task 1>
|  CALL handlerByTask 1
|  CALL handlerByTask 2
|    :
|
|  ------------------------------- <Element 1 of files>
|  |  ---------------------------- <src file 1>
|  |  |  CALL handlerByFileSrc 1
|  |  |  CALL handlerByFileSrc 2
|  |  |    :
|  |  ----------------------------
|  |  ---------------------------- <src file 2>
|  |  |  CALL handlerByFileSrc 1
|  |  |  CALL handlerByFileSrc 2
|  |  |    :
|  |  ----------------------------
|  |    :
|  |
|  |  CALL handlerByFile 1
|  |  CALL handlerByFile 2
|  |    :
|  |
|  |  CALL handlersByContent 1
|  |  CALL handlersByContent 2
|  |    :
|  -------------------------------
|  ------------------------------- <Element 2 of files>
|  |  (Same as <Element 1 of files>)
|  -------------------------------
|    :
----------------------------------
---------------------------------- <Task 2>
|  (Same as <Task 1>)
----------------------------------
  :
```

### <a name ="builtin-handlers">Builtin handlers</a>
You can specify name of builtin handler instead of JavaScript Function.  
Now, taskHelper has following builtin handlers.

#### <a name ="builtin-handlers-newfile">newFile</a>
This is a handler for `handlerByFile` to select files which are newer than `dest` from `src` (or newer than the time when this ran last time).

+ In the basic case, `srcArray` includes a file path and a `dest` file path was specified. The modification times of both files are compared, and if `src` file is newer than `dest` file, return true.  
**One src file : One dest file**

Example: Minify only changed JS files.

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFile: 'newFile',
        filesArray: []
      },
      files: [
        {
          src: 'develop/js/a.js',
          dest: 'public_html/js/a.min.js'
        },
        {
          src: 'develop/js/b.js',
          dest: 'public_html/js/b.min.js'
        }
      ]
    }
  },
  uglify: {
    deploy: {
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

+ When the `srcArray` includes multiple files path and a `dest` file path was specified, if there is any `src` file in which is newer than `dest` file, return true.  
**Some src files : One dest file**

Example: Concatenate files if one or more source files were updated.

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFile: 'newFile',
        filesArray: []
      },
      src: 'develop/css/*.css',
      dest: 'public_html/css/all.css'
    }
  },
  concat: {
    deploy: {
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

+ When the file to compare was not specified (e.g. `dest` was not specified, or `dest` is same file as `src`), if `src` file is newer than the time when this ran last time, return true.  
taskHelper saves log file `.grunt/grunt-task-helper/fileUpdates.json` for compare.  
**One or more src files : No dest file**

Example: You don't need to keep PNG files that is source of minifying, because you have PSD files which is editable always and outputable to PNG.

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFile: 'newFile',
        filesArray: []
      },
      expand: true,
      src: 'public_html/img/*.png'
    }
  },
  imagemin: {
    deploy: {
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

*NOTE:* Logging the modification time of the file after task is best way, but current Grunt can't do it. Therefore the time is got via using `options.mtimeOffset`. (see source code.)

#### <a name ="builtin-handlers-size">size</a>
This is a handler for `handlerByFileSrc` to select files which match specified size.  
You can specify minimum file size to `options.minSize`, and maximum file size to `options.maxSize`. One or both of these must be specified.

Example: Compress only big files.

`Gruntfile.js`

```js
grunt.initConfig({
  taskHelper: {
    deploy: {
      options: {
        handlerByFileSrc: 'size',
        minSize: 1024 * 64,
        filesArray: []
      },
      expand: true,
      src: 'public_html/download/*.csv',
    }
  },
  compress: {
    options: {
      mode: 'gzip'
    },
    deploy: {
      files: '<%= taskHelper.deploy.options.filesArray %>'
    }
  }
});
```

## Release History
 * 2013-08-18			v0.2.0			Added: `options.separator`
 * 2013-08-02			v0.1.0			Initial release.
