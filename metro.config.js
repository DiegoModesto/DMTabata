// Metro: suporte ao SQLite no navegador (expo-sqlite usa WebAssembly + SharedArrayBuffer).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

// SharedArrayBuffer exige "cross-origin isolation" também no servidor de desenvolvimento.
// Em produção os mesmos cabeçalhos vêm do nginx (deploy/nginx.conf).
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
