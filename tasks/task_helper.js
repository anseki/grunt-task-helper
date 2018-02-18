/*
 * grunt-task-helper
 * https://github.com/anseki/grunt-task-helper
 *
 * Copyright (c) 2018 anseki
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  var
    path = require('path'),
    fs = require('fs'),

    builtinHandler = {
      handlerByTask: {},
      handlerByFileSrc: {
        size: function(src, dest, options) {
          if (!grunt.file.exists(src)) { return false; }
          var minSize = parseInt(options.minSize, 10),
            maxSize = parseInt(options.maxSize, 10),
            fileSize = fs.statSync(src).size;
          return (!minSize || fileSize >= minSize) && (!maxSize || fileSize <= maxSize);
        }
      },
      handlerByFile: {
        // 'new' is keyword of language.
        newFile: function(srcArray, dest, options) {
          if (!srcArray.length) {
            // both no data, don't add to filesArray. (Don't return undefined.)
            return typeof dest === 'string' && fileUpdates.isNew(dest, options);
            // But filesArray isn't usable for 'files', 'cause Grunt doesn't support empty src.
          } else if (!dest) {
            return srcArray.some(function(src) {
              return fileUpdates.isNew(src, options);
            });
          } else if (srcArray.length === 1 &&
              path.resolve(srcArray[0]) === path.resolve(dest)) {
            return fileUpdates.isNew(dest, options);
          }
          // both files
          if (srcArray.length === 1) {
            return fileUpdates.compare(srcArray[0], dest) === 1;
          } else {
            // New file exists.
            return srcArray.some(function(src) {
              return fileUpdates.compare(src, dest) === 1;
            });
          }
        }
      },
      handlerByContent: {},
      handlerByAllFiles: {}
    },

    // Static object for mtime of files
    fileUpdates = {
      storeData: null, // { full-path-A : mtime-A, ... }
      storeDataPath: '.grunt/grunt-task-helper/fileUpdates.json',
      offset: null,
      isNew: function(filepath, options) {
        return fileUpdates._getMtime(filepath) > fileUpdates._query(filepath, options);
      },
      compare: function(filepathA, filepathB) {
        var mtimeA = fileUpdates._getMtime(filepathA),
          mtimeB = fileUpdates._getMtime(filepathB);
        return mtimeA < mtimeB ? -1 : mtimeA > mtimeB ? 1 : 0;
      },
      // retrieve mtime as seconds.
      _getMtime: function(filepath) {
        return grunt.file.exists(filepath) ?
          Math.floor(fs.statSync(filepath).mtime.getTime() / 1000) : 0;
        // mtime before epochtime isn't supported.
      },
      // retrieve last update of file.
      _query: function(filepath, options) {
        // options.mtimeOffset: 3 default
        if (!fileUpdates.offset) { fileUpdates.offset = options.mtimeOffset || 3; }
        if (!fileUpdates.storeData) {
          // Initialize data.
          if (grunt.file.exists(fileUpdates.storeDataPath)) {
            fileUpdates.storeData = grunt.file.readJSON(fileUpdates.storeDataPath);
          }
          if (!fileUpdates.storeData) { fileUpdates.storeData = {}; }
          // Run the task that finalize data.
          grunt.task.run('taskHelperFin');
          // The task starts after current target. NOT task.
          // (i.e. every target, and before other tasks)
          // Can't specify time after all tasks?
          // Grunt 0.5 may support a event that all tasks finish.
          // https://github.com/gruntjs/grunt/wiki/Roadmap
        }

        filepath = path.resolve(filepath); // full-path
        if (!(filepath in fileUpdates.storeData)) { fileUpdates.storeData[filepath] = 0; }
        return fileUpdates.storeData[filepath];
      },
      commit: function() { // Initialize data.
        if (!fileUpdates.storeData) { return; } // No data.
        var filepath,
          mtime = Math.floor((new Date()).getTime() / 1000) + fileUpdates.offset; // sec. (+offset)
          // Can't get real mtime because the file may be updated. (Read _query().)

        for (filepath in fileUpdates.storeData) {
          if (grunt.file.exists(filepath)) {
            fileUpdates.storeData[filepath] = mtime;
          } else {
            delete fileUpdates.storeData[filepath];
          }
        }

        if (!grunt.file.write(fileUpdates.storeDataPath,
            JSON.stringify(fileUpdates.storeData))) {
          grunt.fail.warn('Can\'t write to file "' + fileUpdates.storeDataPath + '".');
        }
        fileUpdates.storeData = null;
      }
    };

  // Wrap handler
  function callHandler(handler, argsArray, handlerClass) {
    try {
      return handler.apply(grunt.task.current, argsArray);
    } catch (e) {
      grunt.log.error(e);
      grunt.fail.warn(handlerClass + ' failed.');
    }
  }

  // filter() & set builtinHandler
  function initHandlers(options, handlerClass) {
    var optHandlers = Array.isArray(options[handlerClass]) ?
          options[handlerClass] : [options[handlerClass]],
      handlers = [];
    optHandlers.forEach(function(handler) {
      if (typeof handler === 'function') {
        handlers.push(handler);
      } else if (typeof handler === 'string' && builtinHandler[handlerClass][handler]) {
        handlers.push(builtinHandler[handlerClass][handler]);
      }
    });
    return handlers;
  }

  grunt.registerMultiTask('taskHelper',
    'Help with handling the files (e.g. check changed files) before' +
      ' other tasks, or adding something (e.g. replace text).', function() {

    var
      options = this.options({
        handlerByTask: [], handlerByFileSrc: [],
        handlerByFile: [], handlerByContent: [], handlerByAllFiles: []
      }),
      handlersByTask      = initHandlers(options, 'handlerByTask'),
      handlersByFileSrc   = initHandlers(options, 'handlerByFileSrc'),
      handlersByFile      = initHandlers(options, 'handlerByFile'),
      handlersByContent   = initHandlers(options, 'handlerByContent'),
      handlersByAllFiles  = initHandlers(options, 'handlerByAllFiles'),
      filesArray = [], // files of current.
      // options() retrieves copied values.
      optFilesArray = grunt.config.getRaw([this.name, this.target, 'options', 'filesArray']);
    if (!Array.isArray(optFilesArray)) { optFilesArray = false; }

    // HANDLER: handlerByTask(options)
    if (!handlersByTask.every(function(handler) {
          return callHandler(handler, [options], 'handlerByTask') !== false;
        })) {
      grunt.log.writeln('Task is aborted by handlerByTask.');
      return;
    }

    if (!handlersByFileSrc.length && !handlersByFile.length &&
        !handlersByContent.length && !handlersByAllFiles.length && !optFilesArray)
      { return; } // No file access.

    this.files.forEach(function(f) {
      var dest = f.dest, srcArray = [], content;
      if (f.src && Array.isArray(f.src)) { // Valid src is always array.
        // Change & filter
        srcArray = f.src.map(function(src) {
          // Warn on and remove invalid source files (if nonull was set).
          if (!grunt.file.exists(src)) {
            grunt.log.warn('Source file "' + src + '" not found.');
            return undefined;
          } else {
            // HANDLER: handlerByFileSrc(src, dest, options)
            return handlersByFileSrc.every(function(handler) {
              var res = callHandler(handler, [src, dest, options], 'handlerByFileSrc');
              return typeof res === 'string' ? (src = res, true) : res !== false;
            }) ? src : undefined;
          }
        }).filter(function(src) { return typeof src === 'string'; });
      }

      // HANDLER: handlerByFile(srcArray, dest, options)
      if (handlersByFile.every(function(handler) {
            var res = callHandler(handler, [srcArray, dest, options], 'handlerByFile');
            return typeof res === 'string' ? (dest = res, true) : res !== false;
          })) {

        // Grunt not supports empty src.
        if (srcArray.length) {
          filesArray.push({ src: srcArray, dest: dest });

          if (dest && handlersByContent.length &&
              // dest is writable. (This check is incomplete.)
              (!grunt.file.exists(dest) || grunt.file.isFile(dest))) {

            content = (function() {
              var contentArray = srcArray.map(function(src) { return grunt.file.read(src); });
              if (typeof options.separator !== 'string') {
                // Find out 1st NL.
                if (!contentArray.some(function(content) {
                      var nl = content.match(/(\r\n?|\n\r?)/); // never use LFCR (\n\r).
                      if (nl) {
                        options.separator = nl[1];
                        return true;
                      }
                    })) {
                  // Not found NL.
                  options.separator = grunt.util.linefeed;
                }
              }
              return contentArray.join(options.separator);
            })();

            // HANDLER: contentDest = handlerByContent(contentSrc, options)
            if (handlersByContent.every(function(handler) {
                  content = callHandler(handler, [content, options], 'handlerByContent');
                  return content !== false;
                })) {
              // Write the destination file.
              grunt.file.write(dest, content);
              grunt.log.writeln('File "' + dest + '" created.');
            }
          }
        }
      }
    });

    if (optFilesArray) {
      filesArray.forEach(function(f) { optFilesArray.push(f); });
    }

    // HANDLER: handlerByAllFiles(files, options)
    if (!handlersByAllFiles.every(function(handler) {
          return callHandler(handler, [filesArray, options], 'handlerByAllFiles') !== false;
        })) {
      grunt.log.writeln('Task is aborted by handlerByAllFiles.');
      return;
    }

  });

  grunt.registerTask('taskHelperFin', 'Finalize data.', function() {
    fileUpdates.commit();
  });
};
