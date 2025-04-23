// @ts-check

/**
 * @type {Record<string, (files: string[]) => string[]>}
 */
const config = {
  // Only run on files in src directory
  'src/**/*.{js,ts}': (files) => {
    return [
      `eslint --cache --fix ${files.join(' ')}`,
      `prettier --write ${files.join(' ')}`
    ];
  },
  // Only run on specific files in the root and docs directory
  '{docs,}/*.{json,md,yml,yaml}': (files) => {
    return [`prettier --write ${files.join(' ')}`];
  }
};

module.exports = config; 