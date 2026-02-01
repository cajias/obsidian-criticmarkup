import { type EditorSelection } from "@codemirror/state";

import { CriticMarkupRange } from "../ranges";

export function  applyToText(
	text: string,
	fn: (range: CriticMarkupRange, text: string) => string,
	ranges: CriticMarkupRange[],
) {
	let output = "";
	let last_range = 0;
	for (const range of ranges) {
		output += text.slice(last_range, range.from) + fn(range, text);
		last_range = range.to;
	}
	return output + text.slice(last_range);
}

export function is_forward_movement(prev_selection: EditorSelection, next_selection: EditorSelection) {
	return prev_selection.main.head < next_selection.main.head;
}
