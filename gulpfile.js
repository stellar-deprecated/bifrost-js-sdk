var fs = require('fs');
var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
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
    .pipe(plugins.webpack({
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
    .pipe(plugins.insert.prepend(fs.readFileSync('./node_modules/event-source-polyfill/src/eventsource.js')))
    .pipe(plugins.rename('bifrost.js'))
    .pipe(gulp.dest('dist'))
    .pipe(plugins.uglify({
      output: {
        ascii_only: true
      }
    }))
    .pipe(plugins.rename('bifrost.min.js'))
    .pipe(gulp.dest('dist'));
}
