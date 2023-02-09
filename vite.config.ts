import {defineConfig, type PluginOption} from 'vite';
import react from '@vitejs/plugin-react-swc';
import frontMatter from 'front-matter';

const markdownProcessor: PluginOption = {
	name: 'markdown-processor',
	transform(code, id) {
		if (!id.endsWith('.md')) {
			return null;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const {attributes, body} = frontMatter<any>(code);

		return `export default ${JSON.stringify({
			...attributes,
			body,
		})}`;
	},
};

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react(), markdownProcessor],
});
