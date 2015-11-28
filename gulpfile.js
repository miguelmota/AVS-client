var gulp        = require('gulp'),
    $           = require('gulp-load-plugins')(),
    path        = require('path'),
    browserSync = require('browser-sync'),
    through2    = require('through2'),
    reload      = browserSync.reload,
    browserify  = require('browserify'),
    del         = require('del'),
    argv        = require('yargs').argv,
    sass        = require('gulp-sass');

gulp.task('browser-sync', function() {
  browserSync({
    open: !!argv.open,
    notify: !!argv.notify,
    server: {
      baseDir: './dist'
    }
  });
});

gulp.task('sass', function() {
  return gulp.src('./src/stylesheets/**/*.{scss,sass}')
    .pipe($.plumber())
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest('dist/stylesheets'));
});


gulp.task('js', function() {
  return gulp.src([
    'src/scripts/main.js'
    ])
    .pipe($.plumber())
    .pipe(through2.obj(function (file, enc, next) {
      browserify(file.path, { debug: true })
        .transform(require('babelify'))
        .transform(require('debowerify'))
        .bundle(function (err, res) {
          if (err) { return next(err); }
          file.contents = res;
            next(null, file);
        });
      }))
      .on('error', function (error) {
        console.log(error.stack);
        this.emit('end')
    })
  .pipe($.rename('app.js'))
  .pipe(gulp.dest('dist/scripts/'));
});

gulp.task('clean', function(cb) {
  del('./dist', cb);
});

gulp.task('images', function() {
   gulp.src('./src/libs/**/*')
    .pipe(gulp.dest('./dist/libs'))

  return gulp.src('./src/images/**/*')
    .pipe($.imagemin({
      progressive: true
    }))
    .pipe(gulp.dest('./dist/images'))
})

gulp.task('templates', function() {
  return gulp.src('src/**/*.html')
    .pipe($.plumber())
    .pipe( gulp.dest('dist/'))
});

gulp.task('copy', function() {
  return gulp.src([
    'src/scripts/recorder.js',
    'src/scripts/recorderWorker.js'
  ])
  .pipe($.rename({dirname: ''}))
  .pipe(gulp.dest('dist/scripts'));
});

gulp.task('build', ['sass', 'js', 'copy', 'templates']);

gulp.task('serve', ['build', 'browser-sync'], function () {
  gulp.watch('src/stylesheets/**/*.{scss,sass}',['sass', reload]);
  gulp.watch('src/scripts/**/*.js',['js', reload]);
  gulp.watch('src/images/**/*',['images', reload]);
  gulp.watch('src/*.html',['templates', reload]);
});

gulp.task('default', ['serve']);
