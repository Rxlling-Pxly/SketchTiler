/**
 * If you have the Prettier VS Code extension installed it will use this config
 * @see https://prettier.io/docs/configuration
 * @see https://prettier.io/docs/options
 * @see https://prettier-config-generator.com
 * @type {import("prettier").Config}
 */
const config = {
  arrowParens: "always",
  bracketSameLine: false,
  bracketSpacing: true,
  embeddedLanguageFormatting: "auto",
  endOfLine: "crlf",
  experimentalOperatorPosition: "end",
  experimentalTernaries: true,
  htmlWhitespaceSensitivity: "css",
  insertPragma: false,
  objectWrap: "preserve",
  printWidth: 80,
  proseWrap: "preserve",
  quoteProps: "as-needed",
  rangeStart: 0,
  requirePragma: false,
  semi: true,
  singleAttributePerLine: false,
  singleQuote: false,
  tabWidth: 2,
  trailingComma: "all",
  useTabs: false
};

module.exports = config;