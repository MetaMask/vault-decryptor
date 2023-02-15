Object.defineProperty(globalThis, 'crypto', {
  value: {
    subtle: require('crypto').subtle,
  }
});
