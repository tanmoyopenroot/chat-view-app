'use strict';

require('es6-promise').polyfill();

var gulp = require('gulp');
var $ = require('gulp-load-plugins')();
var del = require('del');
var runSequence = require('run-sequence');
var browserSync = require('browser-sync');
var reload = browserSync.reload;
var merge = require('merge-stream');
var path = require('path');
var fs = require('fs');
var historyApiFallback = require('connect-history-api-fallback');

var AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

var DIST = 'dist';

var dist = function(subpath) {
  return !subpath ? DIST : path.join(DIST, subpath);
};

var styleTask = function(stylesPath, srcs) {
  return gulp.src(srcs.map(function(src) {
      return path.join('app', stylesPath, src);
    }))
    .pipe($.changed(stylesPath, {extension: '.css'}))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/' + stylesPath))
    .pipe($.minifyCss())
    .pipe(gulp.dest(dist(stylesPath)))
    .pipe($.size({title: stylesPath}));
};

var optimizeHtmlTask = function(src, dest) {
  var assets = $.useref({
    searchPath: ['.tmp', 'dist']
  });

  return gulp.src(src)
    .pipe(assets)
    .pipe($.if('*.js', $.uglify({
      preserveComments: 'some'
    })))
    .pipe($.if('*.css', $.minifyCss()))
    // .pipe(assets.restore())
    // .pipe($.useref())
    // .pipe($.if('*.html', $.minifyHtml({
    //   quotes: true,
    //   empty: true,
    //   spare: true
    // })))

    .pipe(gulp.dest(dest))
    .pipe($.size({
      title: 'html'
    }));
};

gulp.task('styles', function() {
  return styleTask('styles', ['**/*.css']);
});

gulp.task('copy', function() {
  var app = gulp.src([
    'app/*',
    '!app/test',
    '!app/elements',
    '!app/bower_components',
    '!**/.DS_Store'
  ], {
    dot: true
  }).pipe(gulp.dest(dist()));

  var bower = gulp.src([
    'app/bower_components/{webcomponentsjs}/**/*'
  ]).pipe(gulp.dest(dist('bower_components')));

  var tmp = gulp.src([
    'app/bower_components/**/*'
  ]).pipe(gulp.dest('.tmp/bower_components'));

  return merge(app, bower, tmp)
    .pipe($.size({
      title: 'copy'
    }));
});

gulp.task('html', function() {
  return optimizeHtmlTask([
      'app/**/*.html',
      '!app/{elements,test,bower_components}/**/*.html'
    ],
    dist());
});

gulp.task('vulcanize', function() {
  return gulp.src('.tmp/elements/elements.html')
    .pipe($.vulcanize({
      stripComments: true,
      inlineCss: true,
      inlineScripts: true
    }))
    .pipe(gulp.dest(dist('elements')))
    .pipe($.size({title: 'vulcanize'}));
});

gulp.task('js', function () {
  return gulp.src([
      'app/**/*.{js,html}',
      '!app/bower_components/**/*'
    ])
    .pipe($.if('*.html', $.crisper({scriptInHead:false})))
    .pipe($.sourcemaps.init())
    .pipe($.if('*.js', $.babel({
      presets: ['es2015']
    })))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest('.tmp/'))
    .pipe(gulp.dest('dist/'));
 });

gulp.task('clean', function() {
  return del(['.tmp', dist()]);
});

gulp.task('serve', ['styles', 'html', 'js'], function() {
  browserSync({
    port: 5000,
    notify: false,
    logPrefix: 'APP',
    snippetOptions: {
      rule: {
        match: '<span id="browser-sync-binding"></span>',
        fn: function(snippet) {
          return snippet;
        }
      }
    },

    server: {
      baseDir: ['.tmp', 'app'],
      middleware: [historyApiFallback()]
    }
  });

  gulp.watch(['app/**/*.html', '!app/bower_components/**/*.html'], ['js', reload]);
  gulp.watch(['app/styles/**/*.css'], ['styles', reload]);
});

gulp.task('default', ['clean'], function(cb) {
  runSequence(
    ['copy', 'styles'],
    ['html', 'js'],
    'vulcanize',
    cb);
});

