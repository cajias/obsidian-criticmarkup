import { type ChangeSpec, EditorState } from "@codemirror/state";

import type { App, TFile } from "obsidian";

import { applyToText, rangeParser } from "../edit-util";
import { CriticMarkupRange, SuggestionType } from "../ranges";

// TODO: More sophisticated removal handling
export function acceptSuggestions(state: EditorState, from?: number, to?: number, remove_attached_comments: boolean = true): ChangeSpec[] {
	const range_field = state.field(rangeParser).ranges;
	return ((from || to) ? range_field.ranges_in_interval(from ?? 0, to ?? Infinity) : range_field.ranges)
		.filter(range =>
			range.type === SuggestionType.ADDITION || range.type === SuggestionType.DELETION ||
			range.type === SuggestionType.SUBSTITUTION
		)
		.map(range => ({ from: range.from, to: remove_attached_comments ? range.full_range_back : range.to, insert: range.accept() }));
}

export function rejectSuggestions(state: EditorState, from?: number, to?: number, remove_attached_comments: boolean = true): ChangeSpec[] {
	const range_field = state.field(rangeParser).ranges;
	return ((from || to) ? range_field.ranges_in_interval(from ?? 0, to ?? Infinity) : range_field.ranges)
		.filter(range =>
			range.type === SuggestionType.ADDITION || range.type === SuggestionType.DELETION ||
			range.type === SuggestionType.SUBSTITUTION
		)
		.map(range => ({ from: range.from, to: remove_attached_comments ? range.full_range_back : range.to, insert: range.reject() }));
}

export async function applyToFile(
	applyFn: (range: CriticMarkupRange, text: string) => string,
	app: App,
	file: TFile,
	ranges: CriticMarkupRange[],
	remove_attached_comments: boolean = true,
): Promise<void> {
	ranges.sort((a, b) => a.from - b.from);
	const text = await app.vault.read(file);

	// When remove_attached_comments is true, we need to also remove the attached comment
	// ranges. We do this by adding the comment ranges to the rangesToApply array so they
	// will be replaced with empty strings along with the suggestion.
	const rangesToApply: CriticMarkupRange[] = [];
	if (remove_attached_comments) {
		for (const range of ranges) {
			rangesToApply.push(range);
			// Add attached comment ranges to be removed
			if (range.replies.length > 0) {
				rangesToApply.push(...range.replies);
			}
		}
		rangesToApply.sort((a, b) => a.from - b.from);
	} else {
		rangesToApply.push(...ranges);
	}

	const output = applyToText(text, (range, text) => {
		// For comment ranges that are being removed, return empty string
		if (remove_attached_comments && range.type === SuggestionType.COMMENT) {
			return "";
		}
		return applyFn(range, text);
	}, rangesToApply);

	await app.vault.modify(file, output);
}
