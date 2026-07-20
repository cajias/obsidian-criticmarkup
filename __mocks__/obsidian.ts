// Initialize globals that are needed by Obsidian modules
if (typeof globalThis !== 'undefined') {
	// Mock createDiv function
	(globalThis as any).createDiv = (clsOrInfo?: string | string[] | { cls?: string | string[]; text?: string }): HTMLDivElement => {
		try {
			const div = document.createElement('div');
			if (clsOrInfo) {
				if (typeof clsOrInfo === 'string') {
					div.classList.add(clsOrInfo);
				} else if (Array.isArray(clsOrInfo)) {
					div.classList.add(...clsOrInfo);
				} else {
					if (clsOrInfo.cls) {
						if (Array.isArray(clsOrInfo.cls)) {
							div.classList.add(...clsOrInfo.cls);
						} else {
							div.classList.add(clsOrInfo.cls);
						}
					}
					if (clsOrInfo.text) {
						div.textContent = clsOrInfo.text;
					}
				}
			}
			return div;
		} catch (e) {
			// Fallback if document is not available
			return {} as HTMLDivElement;
		}
	};

	// Mock createSpan function
	(globalThis as any).createSpan = (clsOrInfo?: string | string[] | { cls?: string | string[]; text?: string }): HTMLSpanElement => {
		try {
			const span = document.createElement('span');
			if (clsOrInfo) {
				if (typeof clsOrInfo === 'string') {
					span.classList.add(clsOrInfo);
				} else if (Array.isArray(clsOrInfo)) {
					span.classList.add(...clsOrInfo);
				} else {
					if (clsOrInfo.cls) {
						if (Array.isArray(clsOrInfo.cls)) {
							span.classList.add(...clsOrInfo.cls);
						} else {
							span.classList.add(clsOrInfo.cls);
						}
					}
					if (clsOrInfo.text) {
						span.textContent = clsOrInfo.text;
					}
				}
			}
			return span;
		} catch (e) {
			// Fallback if document is not available
			return {} as HTMLSpanElement;
		}
	};

	// Create a proper mock Editor class that can serve as a parent class
	// This is needed because the embeddable-editor tries to extend the result of resolveEditorPrototype
	class MockMarkdownView {
		containerEl: HTMLElement = (globalThis as any).createDiv?.() || ({} as HTMLDivElement);
		app: any = null;
		editor: any = null;
		owner: any = { editMode: null, editor: null };
		editMode: any = null;
		editorEl: HTMLElement = (globalThis as any).createDiv?.() || ({} as HTMLDivElement);
		_loaded: boolean = false;

		constructor(app: any, container: HTMLElement, options: any) {
			this.app = app;
			this.containerEl = container;
			this.owner = { editMode: this, editor: this };
		}

		register(cb: any) {}
		onUpdate(update: any, changed: boolean) {}
		buildLocalExtensions() {
			return [];
		}
		getDynamicExtensions() {
			return [];
		}
		updateBottomPadding(height: number) {
			return 0;
		}
		destroy() {}
		onunload() {}
		onload() {}
		set(text: string, focus?: boolean) {}
		get activeCM() {
			return { hasFocus: false };
		}
	}

	// Mock the global app object to prevent "app is not defined" errors
	(globalThis as any).app = {
		scope: {
			register: () => {},
			pushScope: () => {},
			popScope: () => {},
		},
		keymap: {
			pushScope: () => {},
			popScope: () => {},
		},
		workspace: {
			activeEditor: null,
			getLeavesOfType: () => [],
			getLeaf: () => ({ setViewState: async () => {} }),
		},
		embedRegistry: {
			embedByExtension: {
				md: () => {
					const mockEditor = new MockMarkdownView(
						(globalThis as any).app,
						(globalThis as any).createDiv(),
						{}
					);
					return {
						editable: false,
						editMode: mockEditor,
						unload: () => {},
						showEditor: () => {},
					};
				},
			},
		},
	};
}

export const moment = {
	locale: () => {
		return "en";
	},
};

// Minimal Component mock so classes that extend Component (e.g. AnnotationNode) can load in tests
export class Component {
	onload() {}
	onunload() {}
	load() {}
	unload() {}
	register(_cb: () => void) {}
	addChild<T extends Component>(_child: T): T { return _child; }
	removeChild<T extends Component>(_child: T): T { return _child; }
}

// Mock StateField for editorEditorField
export const editorEditorField = Symbol('editorEditorField');

/** @public */
export interface RequestUrlParam {
	/** @public */
	url: string;
	/** @public */
	method?: string;
	/** @public */
	contentType?: string;
	/** @public */
	body?: string | ArrayBuffer;
	/** @public */
	headers?: Record<string, string>;
	/** @public */
	throw?: boolean;
}

/** @public */
export interface RequestUrlResponse {
	/** @public */
	status: number;
	/** @public */
	headers: Record<string, string>;
	/** @public */
	arrayBuffer: ArrayBuffer;
	/** @public */
	json: unknown;
	/** @public */
	text: string;
}

export async function requestUrl(request: RequestUrlParam) {
	const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
    });
    if (response.status >= 400 && request.throw)
        throw new Error(`Request failed, ${response.status}`);
    // Turn response headers into Record<string, string> object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
        headers[key] = value;
    });
    const arraybuffer = await response.arrayBuffer();
    const text = arraybuffer ? new TextDecoder().decode(arraybuffer) : "";
    const json = text ? JSON.parse(text) : {};
    return {
		status: response.status,
		headers: headers,
		arrayBuffer: arraybuffer,
		json: json,
		text: text,
	} satisfies RequestUrlResponse;
}
