import react from '@vitejs/plugin-react';
import svgr from 'vite-plugin-svgr';
import postCssNestingPlugin from 'postcss-nesting';
import dts from 'vite-plugin-dts';
import type { Plugin, PluginOption, UserConfig } from 'vite';
import { readFile } from 'node:fs/promises';

const IS_UMD = process.env.UMD === 'true';

type GraphiQLPluginOptions = {
  /**
   * The plugin name used by the UMD global
   */
  umdExportName: string;
};

function graphiqlPluginConfig({
  umdExportName,
}: GraphiQLPluginOptions): Plugin {
  return {
    name: 'vite-plugin-graphiql-plugin:build',
    enforce: 'pre',
    async config() {
      let packageJSON;
      // TODO: process.env.npm_package_json_path is no longer present in vite. study
      try {
        // more vite plugins to see how others load the full package.json
        // this was originally await import(), but when switching to tsup,
        // the esm build expected a json assert, which is not compatible with cjs
        packageJSON = JSON.parse(
          await readFile(`${process.env.PWD}/package.json`, {
            encoding: 'utf-8',
          }),
        );
      } catch {
        throw new Error(
          'The graphiql plugin vite plugin currently only works if you execute vite commands from the same directory as package.json',
        );
      }
      return {
        css: {
          postcss: {
            plugins: [postCssNestingPlugin()],
          },
        },
        esbuild: {
          // We use function names for generating readable error messages, so we want
          // them to be preserved when building and minifying.
          keepNames: true,
        },
        build: {
          emptyOutDir: !IS_UMD,
          lib: {
            entry: 'src/index.tsx',
            fileName: 'index',
            name: umdExportName,
            formats: IS_UMD ? ['umd'] : ['cjs', 'es'],
          },
          rollupOptions: {
            external: [
              'react-jsx-runtime',
              'graphiql',
              // Exclude peer dependencies and dependencies from bundle
              ...Object.keys(packageJSON.peerDependencies),
              ...(IS_UMD ? [] : Object.keys(packageJSON.dependencies)),
            ],
            output: {
              chunkFileNames: '[name].[format].js',
              globals: {
                '@graphiql/react': 'GraphiQL.React',
                graphql: 'GraphiQL.GraphQL',
                react: 'React',
                'react-dom': 'ReactDOM',
                graphiql: 'GraphiQL',
              },
            },
          },
          commonjsOptions: {
            esmExternals: true,
            requireReturnsDefault: 'auto',
          },
        },
      } as UserConfig;
    },
  };
}

export function graphiqlVitePlugin(
  config: GraphiQLPluginOptions,
): (Plugin | PluginOption[])[] {
  const plugins: Plugin[] = [];
  if (!IS_UMD) {
    plugins.push(
      dts({
        cleanVueFileName: true,
        copyDtsFiles: true,
        outDir: 'types',
        staticImport: true,
      }),
    );
  }
  return [
    graphiqlPluginConfig(config),
    react(),
    ...plugins,
    svgr({
      exportAsDefault: true,
      svgrOptions: {
        titleProp: true,
      },
    }),
  ];
}
