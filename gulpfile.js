const gulp = require("gulp");
const sass = require('gulp-sass')(require('sass'));
const sourcemaps = require('gulp-sourcemaps'); 
const Fiber = require('fibers');
const dartSass = require('dart-sass');
const autoprefixer = require('autoprefixer');
const postcss = require('gulp-postcss');
const browserSync = require('browser-sync').create();

gulp.task('browserSync', function() {
  browserSync.init({
    server: {
      baseDir: "public", // 서버에 띄울 폴더 위치 지정 
      directory: true
    }
  });
  gulp.watch("public/*").on("change", browserSync.reload);
  	// src 안의 파일들을 감시하고 있다가, 내용이 변동되면 재실행 
});

gulp.task(
    "default",
    gulp.parallel("browserSync") 
);

const apfBrwsowsers = [
  'ie >= 8',
];

gulp.task('sass', function(){
  const options = {
    sass : {
      outputStyle: 'expanded',
      indentType: 'tab',
      indentWidth: 1, 
      compiler: dartSass
    },
    postcss: [ autoprefixer({ 
      overrideBrowserslist: apfBrwsowsers,
    }) ]
  };
  return gulp
    .src("public/scss/*.scss") 
    .pipe( 
      sass({
      	includePaths: require("node-normalize-scss").includePaths
      })
    )
    .pipe(sourcemaps.init()) 
    .pipe(sass({fiber:Fiber}).on('error', sass.logError))
    .pipe(postcss(options.postcss))
    .pipe(sourcemaps.write('./maps')) 
    .pipe(gulp.dest("public/scss")) 
    .pipe(browserSync.stream()); // ★★★★ add
    	// ★★★★ browserSync 가 실행되고 있을 때, scss 변화가 감지되면 바로 수정 반영
});

// ★★★★ add start : 감시대상 scss가 변동되면 자동으로 업데이트!
gulp.task('watch', function () { 
  gulp.watch('public/scss/*.scss', gulp.series('sass')); // 감시해야할 scss 위치 지정
});
// ★★★★ aadd end

gulp.task(
    "default",
    gulp.parallel("sass", "watch", "browserSync") // ★★★★ add browserSync
);