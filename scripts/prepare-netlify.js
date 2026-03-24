const fs = require("fs");
const path = require("path");

const rootConfig = path.join(__dirname, "..", "providers.config.json");
const publicDir = path.join(__dirname, "..", "public");
const publicConfig = path.join(publicDir, "providers.config.json");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.copyFileSync(rootConfig, publicConfig);
console.log(`Prepared Netlify config: ${publicConfig}`);
