import {observer} from 'mobx-react-lite';
import {useEffect, useRef, useState} from 'react';
import {store} from '../store/store.js';
import {LinePrefix} from './line-prefix.js';
import {InputText} from './input-text.js';
import './input.scss';

export const Input = observer(() => {
	const {history, path, system, completion} = store;

	const inputRef = useRef<HTMLInputElement>(null);
	const [position, setPosition] = useState({start: 0, end: 0});

	function updateStartEnd(): void {
		setPosition({
			start: inputRef.current?.selectionStart ?? 0,
			end: inputRef.current?.selectionEnd ?? 0,
		});
	}

	function moveCaretToEnd(): void {
		setTimeout(() => {
			inputRef.current?.setSelectionRange(inputRef.current?.value.length, inputRef.current?.value.length);
			updateStartEnd();
		}, 10);
	}

	function keydown(event: KeyboardEvent): void {
		switch (event.key) {
			case 'Enter': {
				if (completion.selected) {
					history.set(completion.selected + ' ');
					completion.reset();
				} else {
					completion.reset();
					void system.addCommand(history.value);
					history.add();
				}

				break;
			}

			case 'ArrowUp': {
				event.preventDefault();
				history.up();
				moveCaretToEnd();
				completion.reset();
				break;
			}

			case 'ArrowDown': {
				event.preventDefault();
				history.down();
				moveCaretToEnd();
				completion.reset();
				break;
			}

			case 'Tab': {
				event.preventDefault();
				if (completion.theOne) {
					history.set(completion.theOne + ' ');
					completion.reset();
				} else {
					completion.next();
				}

				break;
			}

			default:
		}

		inputRef.current?.focus();
		updateStartEnd();
	}

	function click(): void {
		inputRef.current?.focus();
		updateStartEnd();
	}

	useEffect(() => {
		document.addEventListener('keydown', keydown);
		document.addEventListener('click', click);

		return () => {
			document.removeEventListener('keydown', keydown);
			document.removeEventListener('click', click);
		};
	}, []);

	return <li className='Input'>
		<LinePrefix path={path.value}/> <InputText value={history.value} start={position.start} end={position.end}/>
		<input
			ref={inputRef}
			value={history.value}
			onSelect={updateStartEnd}
			onKeyUp={updateStartEnd}
			onKeyDown={updateStartEnd}
			onChange={updateStartEnd}
			onInput={event => {
				history.set(event.currentTarget.value);
				updateStartEnd();
			}}
		/>
	</li>;
});
