import {makeAutoObservable} from 'mobx';

function fontCompare(font: string, baseFont: string): boolean {
	const context = document.createElement('canvas').getContext('2d');
	if (!context) {
		return false;
	}

	const text = 'abcdefghijklmnopqrstuvwxyz0123456789';
	context.font = `72px ${baseFont}`;
	const baselineSize = context.measureText(text).width;
	context.font = `72px ${font}, ${baseFont}`;
	const newSize = context.measureText(text).width;
	return newSize !== baselineSize;
}

function isFontExist(font: string): boolean {
	return Boolean(fontCompare(font, 'serif')
    || fontCompare(font, 'sans-serif')
    || fontCompare(font, 'cursive')
    || fontCompare(font, 'monospace'));
}

export class Style {
	font = '';

	constructor() {
		makeAutoObservable(this);
	}

	set(font: string): string[] {
		if (!isFontExist(font) && font) {
			return [`Font family **'${font}'** is not installed`];
		}

		this.font = `${font ? font + ', ' : ''}"Courier New", Courier, monospace`;
		return [];
	}
}
