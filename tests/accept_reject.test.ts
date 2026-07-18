import { AdditionRange } from "../src/editor/base/ranges/types/addition_range";
import { DeletionRange } from "../src/editor/base/ranges/types/deletion_range";
import { SubstitutionRange } from "../src/editor/base/ranges/types/substitution_range";
import { HighlightRange } from "../src/editor/base/ranges/types/highlight_range";
import { CommentRange } from "../src/editor/base/ranges/types/comment_range";
import { applyToText } from "../src/editor/base/edit-util/range-operations";
import type { CriticMarkupRange } from "../src/editor/base/ranges/base_range";
import { type ChangeSpec, EditorState } from "@codemirror/state";
import { rangeParser, acceptSuggestions, rejectSuggestions } from "../src/editor/base";
import { DEFAULT_SETTINGS } from "../src/constants";
import { suggestionMode } from "../src/editor/uix/extensions";

// Helper: create ranges with correct from/to/text matching the markup position in a string
function makeAddition(from: number, to: number, text: string, metadata?: number) {
	return new AdditionRange(from, to, text, metadata);
}

function makeDeletion(from: number, to: number, text: string, metadata?: number) {
	return new DeletionRange(from, to, text, metadata);
}

function makeSubstitution(from: number, middle: number, to: number, text: string, metadata?: number) {
	return new SubstitutionRange(from, middle, to, text, metadata);
}

function makeHighlight(from: number, to: number, text: string) {
	return new HighlightRange(from, to, text);
}

function makeComment(from: number, to: number, text: string) {
	return new CommentRange(from, to, text);
}

function getChangeSpec(change: ChangeSpec) {
	if (
		typeof change !== "object" || !change ||
		!("from" in change) || !("to" in change) || !("insert" in change)
	) {
		throw new Error("Expected a simple ChangeSpec object");
	}

	return change as { from: number; to: number; insert: string };
}

// ─── Individual Range Types ───

describe("AdditionRange", () => {
	test("accept returns inner text", () => {
		// {++new text++}  from=0, to=14, text="{++new text++}"
		const r = makeAddition(0, 14, "{++new text++}");
		expect(r.accept()).toBe("new text");
	});

	test("reject returns empty string", () => {
		const r = makeAddition(0, 14, "{++new text++}");
		expect(r.reject()).toBe("");
	});

	test("unwrap returns inner text", () => {
		const r = makeAddition(0, 14, "{++new text++}");
		expect(r.unwrap()).toBe("new text");
	});

	test("empty addition", () => {
		const r = makeAddition(0, 6, "{++++}");
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("");
		expect(r.empty()).toBe(true);
	});

	test("addition with special characters", () => {
		const r = makeAddition(0, 25, "{++hello <world> & 'x'++}");
		expect(r.accept()).toBe("hello <world> & 'x'");
	});
});

describe("DeletionRange", () => {
	test("accept returns empty string", () => {
		const r = makeDeletion(0, 14, "{--old text--}");
		expect(r.accept()).toBe("");
	});

	test("reject returns inner text", () => {
		const r = makeDeletion(0, 14, "{--old text--}");
		expect(r.reject()).toBe("old text");
	});

	test("unwrap returns inner text", () => {
		const r = makeDeletion(0, 14, "{--old text--}");
		expect(r.unwrap()).toBe("old text");
	});

	test("empty deletion", () => {
		const r = makeDeletion(0, 6, "{----}");
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("");
		expect(r.empty()).toBe(true);
	});
});

describe("SubstitutionRange", () => {
	// {~~old~>new~~}  from=0, middle=6, to=14
	// text = "{~~old~>new~~}"
	// char_middle = middle - range_front = 6 - 0 = 6
	// unwrap_parts: [text.slice(3,6), text.slice(8,-3)] = ["old", "new"]

	test("accept returns new text (right side)", () => {
		const r = makeSubstitution(0, 6, 14, "{~~old~>new~~}");
		expect(r.accept()).toBe("new");
	});

	test("reject returns old text (left side)", () => {
		const r = makeSubstitution(0, 6, 14, "{~~old~>new~~}");
		expect(r.reject()).toBe("old");
	});

	test("unwrap returns both parts concatenated", () => {
		const r = makeSubstitution(0, 6, 14, "{~~old~>new~~}");
		expect(r.unwrap()).toBe("oldnew");
	});

	test("unwrap_parts returns [old, new]", () => {
		const r = makeSubstitution(0, 6, 14, "{~~old~>new~~}");
		expect(r.unwrap_parts()).toEqual(["old", "new"]);
	});

	// ─── Substitution Edge Cases ───

	test("empty left side: {~~⁠~>new~~}", () => {
		// {~~~>new~~}  from=0, middle=3, to=11
		// text = "{~~~>new~~}"
		// char_middle = 3 - 0 = 3
		// unwrap_parts: [text.slice(3,3), text.slice(5,-3)] = ["", "new"]
		const r = makeSubstitution(0, 3, 11, "{~~~>new~~}");
		expect(r.accept()).toBe("new");
		expect(r.reject()).toBe("");
		expect(r.unwrap_parts()).toEqual(["", "new"]);
	});

	test("empty right side: {~~old~>~~}", () => {
		// {~~old~>~~}  from=0, middle=6, to=11
		// char_middle = 6
		// unwrap_parts: [text.slice(3,6), text.slice(8,-3)] = ["old", ""]
		const r = makeSubstitution(0, 6, 11, "{~~old~>~~}");
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("old");
		expect(r.unwrap_parts()).toEqual(["old", ""]);
	});

	test("both sides empty: {~~~>~~}", () => {
		// {~~~>~~}  from=0, middle=3, to=8
		const r = makeSubstitution(0, 3, 8, "{~~~>~~}");
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("");
		expect(r.empty()).toBe(true);
	});

	test("multiple ~> in content — only first is separator", () => {
		// {~~a~>b~>c~~}  from=0, middle=4, to=13
		// The middle is at position 4 (first ~>)
		// char_middle = 4
		// unwrap_parts: [text.slice(3,4), text.slice(6,-3)] = ["a", "b~>c"]
		const r = makeSubstitution(0, 4, 13, "{~~a~>b~>c~~}");
		expect(r.reject()).toBe("a");
		expect(r.accept()).toBe("b~>c");
	});

	test("long content with special chars", () => {
		const text = "{~~hello <world>~>goodbye & 'friends'~~}";
		// from=0, to=40
		// middle at position of first ~>: "hello <world>" is 13 chars, so middle = 3 + 13 = 16
		const r = makeSubstitution(0, 16, 40, text);
		expect(r.reject()).toBe("hello <world>");
		expect(r.accept()).toBe("goodbye & 'friends'");
	});

	test("substitution with metadata", () => {
		// {~~{"author":"Alice"}@@old~>new~~}
		// from=0, to=33
		// The metadata end is at position where @@ ends
		// metadata param = position of @@ start = 3 + length of '{"author":"Alice"}' = 3 + 18 = 21
		// After metadata processing, text becomes "{~~old~>new~~}" (metadata stripped from text)
		// middle needs to account for the stripped metadata
		// Original text: {~~{"author":"Alice"}@@old~>new~~}
		// middle in original = 3 + 18 + 2 + 3 = 26 (after @@, after "old")
		const text = '{~~{"author":"Alice"}@@old~>new~~}';
		const metadataPos = 21; // position of @@ in original
		const middle = 26; // position of ~> in original
		const r = makeSubstitution(0, middle, 34, text, metadataPos);
		expect(r.fields.author).toBe("Alice");
		expect(r.accept()).toBe("new");
		expect(r.reject()).toBe("old");
	});

	test("substitution with metadata at non-zero offset", () => {
		// Document: "Some text {~~{"author":"Bob"}@@hello~>world~~}"
		// Substitution starts at position 10
		const text = '{~~{"author":"Bob"}@@hello~>world~~}';
		const from = 10;
		// @@ is at index 19 in text, so absolute position = 10 + 19 = 29
		const metadataPos = from + 19;
		// ~> is at index 26 in text, so absolute position = 10 + 26 = 36
		const middle = from + 26;
		const to = from + text.length; // 46
		const r = makeSubstitution(from, middle, to, text, metadataPos);
		expect(r.fields.author).toBe("Bob");
		expect(r.accept()).toBe("world");
		expect(r.reject()).toBe("hello");
	});

	// ─── Issue #1: Defensive validation for invalid middle ───

	test("SubstitutionRange with invalid middle (before content start) warns", () => {
		const text = "{~~old~>new~~}";
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		// middle=1 is inside the opening bracket {~~, which is invalid
		const r = makeSubstitution(0, 1, 14, text);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Invalid substitution")
		);
		// Should return safe empty strings rather than corrupted slices
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("");
		warnSpy.mockRestore();
	});

	test("SubstitutionRange with invalid middle (after content end) warns", () => {
		const text = "{~~old~>new~~}";
		const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
		// middle=12 is inside the closing bracket ~~}, which is invalid
		const r = makeSubstitution(0, 12, 14, text);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("Invalid substitution")
		);
		expect(r.accept()).toBe("");
		expect(r.reject()).toBe("");
		warnSpy.mockRestore();
	});
});

describe("HighlightRange", () => {
	test("unwrap returns highlighted text", () => {
		// {==highlighted==}  from=0, to=17
		const r = makeHighlight(0, 17, "{==highlighted==}");
		expect(r.unwrap()).toBe("highlighted");
	});

	test("accept returns original text (no-op for highlights)", () => {
		const r = makeHighlight(0, 17, "{==highlighted==}");
		// base_range accept() returns this.text
		expect(r.accept()).toBe("{==highlighted==}");
	});

	test("reject returns original text (no-op for highlights)", () => {
		const r = makeHighlight(0, 17, "{==highlighted==}");
		expect(r.reject()).toBe("{==highlighted==}");
	});
});

describe("CommentRange", () => {
	test("accept with removeComments=true returns empty", () => {
		// {>>comment<<}  from=0, to=13
		const r = makeComment(0, 13, "{>>comment<<}");
		expect(r.accept(true)).toBe("");
	});

	test("accept with removeComments=false returns inner text", () => {
		const r = makeComment(0, 13, "{>>comment<<}");
		expect(r.accept(false)).toBe("comment");
	});

	test("reject with removeComments=true returns empty", () => {
		const r = makeComment(0, 13, "{>>comment<<}");
		expect(r.reject(true)).toBe("");
	});

	test("reject with removeComments=false returns inner text", () => {
		const r = makeComment(0, 13, "{>>comment<<}");
		expect(r.reject(false)).toBe("comment");
	});
});

// ─── applyToText ───

describe("applyToText", () => {
	test("single addition range", () => {
		const text = "hello {++world++} end";
		// {++world++} starts at 6, ends at 17
		const r = makeAddition(6, 17, "{++world++}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("hello world end");
	});

	test("single addition range — reject", () => {
		const text = "hello {++world++} end";
		const r = makeAddition(6, 17, "{++world++}");
		const result = applyToText(text, (range) => range.reject(), [r]);
		expect(result).toBe("hello  end");
	});

	test("single deletion range — accept", () => {
		const text = "hello {--world--} end";
		const r = makeDeletion(6, 17, "{--world--}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("hello  end");
	});

	test("single deletion range — reject", () => {
		const text = "hello {--world--} end";
		const r = makeDeletion(6, 17, "{--world--}");
		const result = applyToText(text, (range) => range.reject(), [r]);
		expect(result).toBe("hello world end");
	});

	test("single substitution — accept", () => {
		const text = "hello {~~old~>new~~} end";
		// {~~old~>new~~} starts at 6, ends at 20, middle at 12
		const r = makeSubstitution(6, 12, 20, "{~~old~>new~~}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("hello new end");
	});

	test("single substitution — reject", () => {
		const text = "hello {~~old~>new~~} end";
		const r = makeSubstitution(6, 12, 20, "{~~old~>new~~}");
		const result = applyToText(text, (range) => range.reject(), [r]);
		expect(result).toBe("hello old end");
	});

	test("multiple non-overlapping ranges", () => {
		const text = "a{++b++}c{--d--}e";
		// {++b++} from=1, to=8
		// {--d--} from=9, to=16
		const r1 = makeAddition(1, 8, "{++b++}");
		const r2 = makeDeletion(9, 16, "{--d--}");
		const result = applyToText(text, (range) => range.accept(), [r1, r2]);
		expect(result).toBe("abce");
	});

	test("multiple non-overlapping ranges — reject", () => {
		const text = "a{++b++}c{--d--}e";
		const r1 = makeAddition(1, 8, "{++b++}");
		const r2 = makeDeletion(9, 16, "{--d--}");
		const result = applyToText(text, (range) => range.reject(), [r1, r2]);
		expect(result).toBe("acde");
	});

	test("adjacent ranges (no gap)", () => {
		const text = "{++a++}{--b--}";
		// {++a++} from=0, to=7
		// {--b--} from=7, to=14
		const r1 = makeAddition(0, 7, "{++a++}");
		const r2 = makeDeletion(7, 14, "{--b--}");
		const result = applyToText(text, (range) => range.accept(), [r1, r2]);
		expect(result).toBe("a");
	});

	test("range at start of text", () => {
		const text = "{++hello++} world";
		const r = makeAddition(0, 11, "{++hello++}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("hello world");
	});

	test("range at end of text", () => {
		const text = "hello {++world++}";
		const r = makeAddition(6, 17, "{++world++}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("hello world");
	});

	test("text outside ranges is preserved exactly", () => {
		const text = "  spaces  {++x++}  tabs\t  ";
		const r = makeAddition(10, 17, "{++x++}");
		const result = applyToText(text, (range) => range.accept(), [r]);
		expect(result).toBe("  spaces  x  tabs\t  ");
	});

	test("no ranges returns original text", () => {
		const text = "hello world";
		const result = applyToText(text, (range) => range.accept(), []);
		expect(result).toBe("hello world");
	});

	test("unwrap function", () => {
		const text = "a{++b++}c{--d--}e{~~f~>g~~}h";
		// {++b++} from=1, to=8
		// {--d--} from=9, to=16
		// {~~f~>g~~} from=17, to=27, middle=21
		const r1 = makeAddition(1, 8, "{++b++}");
		const r2 = makeDeletion(9, 16, "{--d--}");
		const r3 = makeSubstitution(17, 21, 27, "{~~f~>g~~}");
		const result = applyToText(text, (range) => range.unwrap(), [r1, r2, r3]);
		expect(result).toBe("abcdefgh");
	});

	test("range covering entire text", () => {
		const text = "{++everything++}";
		const r = makeAddition(0, 16, "{++everything++}");
		expect(applyToText(text, (range) => range.accept(), [r])).toBe("everything");
		expect(applyToText(text, (range) => range.reject(), [r])).toBe("");
	});
});

// ─── Comment Thread Handling ───

describe("Comment thread handling", () => {
	test("addition with attached comment — full_range_back includes comment", () => {
		// {++text++}{>>comment<<}
		const addition = makeAddition(0, 10, "{++text++}");
		const comment = makeComment(10, 23, "{>>comment<<}");
		comment.attach_to_range(addition);

		expect(addition.full_range_back).toBe(23);
	});

	test("addition with multiple attached comments", () => {
		const addition = makeAddition(0, 10, "{++text++}");
		const c1 = makeComment(10, 21, "{>>first<<}");
		const c2 = makeComment(21, 33, "{>>second<<}");
		c1.attach_to_range(addition);
		c2.attach_to_range(addition);

		expect(addition.replies.length).toBe(2);
		expect(addition.full_range_back).toBe(33);
	});

	test("comment accept with removeComments=true", () => {
		const c = makeComment(0, 13, "{>>comment<<}");
		expect(c.accept(true)).toBe("");
	});

	test("comment accept with removeComments=false", () => {
		const c = makeComment(0, 13, "{>>comment<<}");
		expect(c.accept(false)).toBe("comment");
	});
});

// ─── Preserve comment threads on accept/reject ───

describe("Accept/reject with remove_attached_comments parameter", () => {
	test("acceptSuggestions with remove_attached_comments=false preserves attached comment", () => {
		// {++text++}{>>comment<<}
		const text = "{++text++}{>>comment<<}";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = acceptSuggestions(state, undefined, undefined, false);
		expect(changes.length).toBe(1);
		const change = getChangeSpec(changes[0]);
		expect(change.from).toBe(0);
		expect(change.to).toBe(10); // Should be range.to, not range.full_range_back
		expect(change.insert).toBe("text");
	});

	test("acceptSuggestions with remove_attached_comments=true removes attached comment", () => {
		// {++text++}{>>comment<<}
		const text = "{++text++}{>>comment<<}";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = acceptSuggestions(state, undefined, undefined, true);
		expect(changes.length).toBe(1);
		const change = getChangeSpec(changes[0]);
		expect(change.from).toBe(0);
		expect(change.to).toBe(23); // Should be range.full_range_back, including the comment
		expect(change.insert).toBe("text");
	});

	test("rejectSuggestions with remove_attached_comments=false preserves attached comment", () => {
		const text = "{--old--}{>>why removed<<}";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = rejectSuggestions(state, undefined, undefined, false);
		expect(changes.length).toBe(1);
		const change = getChangeSpec(changes[0]);
		expect(change.from).toBe(0);
		expect(change.to).toBe(9); // Should be range.to, not range.full_range_back
		expect(change.insert).toBe("old");
	});

	test("rejectSuggestions with remove_attached_comments=true removes attached comment", () => {
		const text = "{--old--}{>>why removed<<}";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = rejectSuggestions(state, undefined, undefined, true);
		expect(changes.length).toBe(1);
		const change = getChangeSpec(changes[0]);
		expect(change.from).toBe(0);
		expect(change.to).toBe(26); // Should be range.full_range_back, including the comment
		expect(change.insert).toBe("old");
	});

	test("acceptSuggestions with substitution preserves attached comment when remove_attached_comments=false", () => {
		const text = "before {~~old~>new~~}{>>review note<<} after";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = acceptSuggestions(state, undefined, undefined, false);
		expect(changes.length).toBe(1);
		const change = getChangeSpec(changes[0]);
		expect(change.from).toBe(7);
		expect(change.to).toBe(21); // Should be range.to, not range.full_range_back
		expect(change.insert).toBe("new");
	});

	test("multiple suggestions preserve comments when remove_attached_comments=false", () => {
		const text = "{++a++}{>>c1<<}{--b--}{>>c2<<}";
		const state = EditorState.create({
			doc: text,
			extensions: [rangeParser, suggestionMode(DEFAULT_SETTINGS)],
		});
		
		const changes = acceptSuggestions(state, undefined, undefined, false);
		// Should have 2 changes, one for each suggestion
		expect(changes.length).toBe(2);
		// First change: accept addition
		const firstChange = getChangeSpec(changes[0]);
		expect(firstChange.from).toBe(0);
		expect(firstChange.to).toBe(7); // range.to, not including comment
		expect(firstChange.insert).toBe("a");
		// Second change: accept deletion (removes it)
		const secondChange = getChangeSpec(changes[1]);
		expect(secondChange.from).toBe(14);
		expect(secondChange.to).toBe(21); // range.to, not including comment
		expect(secondChange.insert).toBe("");
	});
});

// ─── Base Range boundary calculations ───

describe("Base range boundaries", () => {
	test("range_start without metadata", () => {
		const r = makeAddition(10, 25, "{++some text++}");
		expect(r.range_start).toBe(13); // from + 3
	});

	test("range_front without metadata", () => {
		const r = makeAddition(10, 25, "{++some text++}");
		expect(r.range_front).toBe(10); // from
	});

	test("length for standard range", () => {
		// {++abc++} = 9 chars, content "abc" = 3
		const r = makeAddition(0, 9, "{++abc++}");
		expect(r.length).toBe(3);
	});

	test("length for substitution range", () => {
		// {~~ab~>cd~~} = 12 chars, content length = 12 - 8 = 4
		const r = makeSubstitution(0, 5, 12, "{~~ab~>cd~~}");
		expect(r.length).toBe(4);
	});

	test("empty() for non-empty range", () => {
		const r = makeAddition(0, 9, "{++abc++}");
		expect(r.empty()).toBe(false);
	});

	test("full_range_front and full_range_back without replies", () => {
		const r = makeAddition(5, 16, "{++hello++}");
		expect(r.full_range_front).toBe(5);
		expect(r.full_range_back).toBe(16);
	});
});
