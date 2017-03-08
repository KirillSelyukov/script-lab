import { Injectable, ElementRef } from '@angular/core';
import { Request, ResponseTypes } from './request';
import { Disposable } from './disposable';
import { AI } from '../helpers';
import { isEmpty } from 'lodash';

const Regex = {
    STARTS_WITH_TYPINGS: /^.types~.+|^dt~.+/i,
    STARTS_WITH_COMMENT: /^\/\/.*|^\/\*.*|.*\*\/$.*/im,
    ENDS_WITH_DTS: /.*\.d\.ts$/i,
    GLOBAL: /.*/i
};

@Injectable()
export class MonacoService extends Disposable {
    private _intellisenseFile = this._request.local<any[]>('libraries.json', ResponseTypes.JSON);

    private _defaults: monaco.editor.IEditorConstructionOptions = {
        value: '',
        language: 'text',
        lineNumbers: true,
        roundedSelection: false,
        scrollBeyondLastLine: false,
        formatOnType: true,
        fontSize: 14,
        wrappingColumn: 0,
        folding: true,
        theme: 'vs',
        wrappingIndent: 'indent',
        scrollbar: {
            vertical: 'visible',
            verticalHasArrows: true,
            arrowSize: 15
        }
    };

    constructor(private _request: Request) {
        super();
        this._registerLanguageServices();
    }

    static current: Promise<typeof monaco>;

    private _typings: Promise<monaco.languages.CompletionItem[]>;
    get typings() {
        if (this._typings == null) {
            this._typings = this._intellisenseFile.toPromise().then(
                item => item
                    .filter(({ typings }) => !isEmpty(typings))
                    .map(({ typings, documentation }) => <monaco.languages.CompletionItem>{
                        label: typings,
                        documentation: documentation,
                        kind: monaco.languages.CompletionItemKind.Module,
                        insertText: `${typings}\n`
                    })
            );
        }

        return this._typings;
    }

    private _libraries: Promise<monaco.languages.CompletionItem[]>;
    get libraries() {
        if (this._libraries == null) {
            this._libraries = this._intellisenseFile.toPromise().then(
                item => item
                    .filter(({ label }) => !isEmpty(label))
                    .map(({ label, documentation }) => <monaco.languages.CompletionItem>{
                        label: label,
                        documentation: documentation,
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: `${label}\n`,
                    })
            );
        }

        return this._libraries;
    }

    async create(element: ElementRef, overrides?: monaco.editor.IEditorConstructionOptions) {
        let options = { ...this._defaults, ...overrides };
        let monaco = await MonacoService.current;
        return monaco.editor.create(element.nativeElement, options);
    }

    updateOptions(editor: monaco.editor.IStandaloneCodeEditor, overrides: monaco.editor.IEditorOptions) {
        if (editor == null || overrides == null) {
            return;
        }

        let options = { ...this._defaults, ...overrides };
        editor.updateOptions(options);
    }

    static initialize() {
        if (MonacoService.current == null) {
            MonacoService.current = MonacoService._loadMonaco();
        }

        return MonacoService.current;
    }

    static _loadMonaco() {
        return new Promise((resolve, reject) => {
            try {
                let start = performance.now();
                let require = (<any>window).require;
                if (require) {
                    let path = `${location.origin}/libs/monaco-editor/vs`;

                    const requireConfig = {
                        paths: {
                            'vs': path
                        }
                    };

                    require.config(requireConfig);
                    require(['vs/editor/editor.main'], () => {
                        let end = performance.now();
                        resolve(monaco);
                        AI.trackEvent('Monaco Loaded', {}, { 'Monaco Load Duration': ((end - start) / 1000) });
                    });
                }
            }
            catch (error) {
                reject(error);
            }
        });
    }

    private async _registerLanguageServices() {
        let monaco = await MonacoService.current;

        monaco.languages.register({ id: 'libraries' });
        monaco.languages.setMonarchTokensProvider('libraries', {
            tokenizer: {
                root: [
                    [Regex.STARTS_WITH_COMMENT, 'comment'],
                    [Regex.STARTS_WITH_TYPINGS, 'string'],
                    [Regex.ENDS_WITH_DTS, 'string'],
                    [Regex.GLOBAL, 'keyword']
                ]
            },
            tokenPostfix: ''
        });

        monaco.languages.registerCompletionItemProvider('libraries', {
            provideCompletionItems: (model, position) => {
                let currentLine = model.getValueInRange({
                    startLineNumber: position.lineNumber,
                    startColumn: 1,
                    endLineNumber: position.lineNumber,
                    endColumn: position.column
                });

                if (Regex.STARTS_WITH_TYPINGS.test(currentLine)) {
                    return this.typings;
                }
                else if (Regex.GLOBAL.test(currentLine)) {
                    return this.libraries;
                }
                else {
                    return [];
                }
            }
        });

        monaco.languages.typescript.typescriptDefaults.compilerOptions = {
            module: monaco.languages.typescript.ModuleKind.CommonJS,
            moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs
        };

        return monaco;
    };
}