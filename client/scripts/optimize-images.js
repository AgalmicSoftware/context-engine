
const { exec } = require('child_process');

const command = 'imagemin build/images/*.{jpg,jpeg,png,gif,svg} --out-dir=build/images';

// Set a much larger buffer size (e.g., 10MB)
const options = {
  maxBuffer: 10 * 1024 * 1024 
};

console.log('Running image optimization...');

const child = exec(command, options, (error, stdout, stderr) => {
  if (error) {
    console.error(`Image optimization failed:`);
    console.error(error);
    process.exit(1);
  }

  // Log the output from imagemin so you can see the results
  if (stdout) {
    console.log(stdout);
  }
  if (stderr) {
    console.error(stderr);
  }
  
  console.log('Image optimization complete!');
});