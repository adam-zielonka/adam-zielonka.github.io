import {observer} from 'mobx-react-lite';
import {store} from '../store/store.js';
import {Shutdown} from './shutdown.js';
import {Line} from './line.js';
import {Input} from './input.js';
import './terminal.scss';
import {Completion} from './completion.js';

export const Terminal = observer(() => {
	if (store.system.shutdown) {
		return <Shutdown/>;
	}

	return <div className='Terminal' style={{fontFamily: store.style.font}}>
		<ul>
			{store.output.lines.map((line, i) => <Line key={i} line={line}/>)}
			{store.system.isInputAllowed && <Input/>}
			<Completion/>
		</ul>
	</div>;
});
