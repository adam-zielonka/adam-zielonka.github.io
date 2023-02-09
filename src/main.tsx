import React from 'react';
// eslint-disable-next-line n/file-extension-in-import
import ReactDOM from 'react-dom/client';
import {Terminal} from './components/terminal.js';
import './main.css';

document.querySelector('#noscript')?.remove();

ReactDOM.createRoot(document.querySelector('#root')!).render(
	<React.StrictMode>
		<Terminal />
	</React.StrictMode>,
);
