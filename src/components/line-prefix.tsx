import './line-prefix.scss';

type Prefix = {
	user?: string;
	domain?: string;
	path?: string;
};

export function LinePrefix({user = 'root', domain = 'adamzielonka.pro', path = '~'}: Prefix) {
	return <span className='LinePrefix'>
		<span className='user'>{user}@{domain}</span>:<span className='path'>{path}</span>#
	</span>;
}
