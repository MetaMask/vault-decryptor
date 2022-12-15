module.exports = {
  extractVaultFromLMDB: (data) =>
    data.match(/"KeyringController":{"vault":"{[^{}]*}"/)
      .map(m => m.substring(29))
      .map(s => JSON.parse(JSON.parse(s)))
      [0]
};
