import './input-text.scss';

type InputTextProps = {
	value: string;
	start: number;
	end: number;
};

export function InputText({value, start, end}: InputTextProps) {
	const isSelection = start !== end;
	const newEnd = end + (isSelection ? 0 : 1);
	const newValue = value.replace(/ /g, '\u00A0');

	const beforeText = newValue.slice(0, start);
	const text = newValue.slice(start, newEnd) || '\u00A0';
	const afterText = newValue.slice(newEnd);

	return <span className='InputText'>
		{beforeText}<span className={isSelection ? 'selection' : 'caret'}>{text}</span>{afterText}
	</span>;
}
