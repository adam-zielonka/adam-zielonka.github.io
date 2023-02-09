import {observer} from 'mobx-react-lite';
import {useEffect} from 'react';
import {store} from '../store/store.js';
import './completion.scss';

export const Completion = observer(() => {
	if (!store.completion.isVisible) {
		return null;
	}

	return <li className='Completion'>
		{store.completion.list.map(completion => <Element key={completion} value={completion}/>)}
	</li>;
});

const Element = observer(({value}: {value: string}) => {
	useEffect(() => {
		window.scrollTo(0, document.body.scrollHeight);
	});

	return <div className={store.completion.selected === value ? 'active' : ''}>
		{value}
	</div>;
});
