var fs = require('fs');
var gulp = require('gulp');
var guglify = require('gulp-uglify');
var grename = require('gulp-rename');
var ginsert = require('gulp-insert');
var gwebpack = require('gulp-webpack');
var webpack = require('webpack');

gulp.task('default', ['build']);

gulp.task('build:node', function() {
  buildLibrary('umd');
});

gulp.task('build', function() {
  buildLibrary('var');
});

function buildLibrary(target) {
  return gulp.src('src/index.js')
    .pipe(gwebpack({
      output: {
        library: 'Bifrost',
        libraryTarget: target
      },
      module: {
        loaders: [{
          test: /\.js$/,
          exclude: /node_modules/,
          loader: 'babel-loader'
        }],
      },
      plugins: [
        // Ignore native modules (ed25519)
        new webpack.IgnorePlugin(/ed25519/)
      ]
    }))
    // Add EventSource polyfill for IE11 and Edge
    .pipe(ginsert.prepend(fs.readFileSync('./node_modules/event-source-polyfill/src/eventsource.js')))
    .pipe(grename('bifrost.js'))
    .pipe(gulp.dest('dist'))
    .pipe(guglify({
      output: {
        ascii_only: true
      }
    }))
    .pipe(grename('bifrost.min.js'))
    .pipe(gulp.dest('dist'));
}
