// Minimal test setup to provide global mocks required by the codebase
// This must run before any test files are loaded

console.log('[TEST-SETUP] Starting test setup');

// Mock createDiv - used by embeddable-editor
(globalThis as any).createDiv = () => document.createElement('div');

console.log('[TEST-SETUP] createDiv mocked');

// Mock global app - required by embeddable-editor.ts at module load time
// The embeddable-editor uses resolveEditorPrototype(app) at class definition time
// which calls: Object.getPrototypeOf(Object.getPrototypeOf(editMode)).constructor
// We need to return a constructor function from the prototype chain

// Make the mock classes globally accessible to avoid scope issues with esbuild-jest
class _MockEditorBase {
	constructor(app: any, container: HTMLElement, options: any) {}
	buildLocalExtensions() { return []; }
	getDynamicExtensions() { return []; }
}

class _MockEditor extends _MockEditorBase {
	constructor(app: any, container: HTMLElement, options: any) {
		super(app, container, options);
	}
}

// Attach to globalThis to ensure they're available across module boundaries
(globalThis as any).MockEditorBase = _MockEditorBase;
(globalThis as any).MockEditor = _MockEditor;

console.log('[TEST-SETUP] Mock classes defined and made global');

(globalThis as any).app = {
	embedRegistry: {
		embedByExtension: {
			md: () => {
				console.log('[TEST-SETUP] app.embedRegistry.embedByExtension.md called');
				const MockEditor = (globalThis as any).MockEditor;
				const mockEditor = new MockEditor(null as any, document.createElement('div'), {});
				
				const widgetView = {
					_editable: false,
					_editMode: mockEditor,
					get editable() { 
						console.log('[TEST-SETUP] widgetView.editable getter called');
						return this._editable; 
					},
					set editable(value: boolean) { 
						console.log('[TEST-SETUP] widgetView.editable setter called with:', value);
						this._editable = value; 
					},
					get editMode() {
						console.log('[TEST-SETUP] widgetView.editMode getter called, returning:', !!this._editMode);
						return this._editMode;
					},
					set editMode(value: any) {
						console.log('[TEST-SETUP] widgetView.editMode setter called with:', !!value);
						this._editMode = value;
					},
					unload: () => { console.log('[TEST-SETUP] widgetView.unload called'); },
					showEditor: () => { console.log('[TEST-SETUP] widgetView.showEditor called'); },
				};
				
				console.log('[TEST-SETUP] widgetView created');
				return widgetView;
			},
		},
	},
};

console.log('[TEST-SETUP] Global app mocked');
console.log('[TEST-SETUP] Test setup complete');
