module.exports = {
  default: {
    requireModule: ['tsx/cjs'],
    require: ['features/steps/**/*.ts', 'features/support/**/*.ts'],
    paths: ['features/**/*.feature'],
    format: ['progress'],
  },
};
