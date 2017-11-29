'use strict';
import { commands, ConfigurationChangeEvent, ConfigurationTarget, Event, EventEmitter, ExtensionContext, TreeDataProvider, TreeItem } from 'vscode';
import { configuration, ExplorerFilesLayout, IExplorerConfig } from '../configuration';
import { CommandContext, setCommandContext, WorkspaceState } from '../constants';
import { ExplorerCommands, RefreshNodeCommandArgs } from './explorerCommands';
import { ExplorerNode, MessageNode, RefreshReason, SearchCommitsResultsNode } from './explorerNodes';
import { GitLog, GitService } from '../gitService';
import { Logger } from '../logger';

export * from './explorerNodes';

let resultsExplorer: ResultsExplorer | undefined;
export function getResultsExplorer(): ResultsExplorer | undefined {
    return resultsExplorer;
}

export class ResultsExplorer implements TreeDataProvider<ExplorerNode> {

    private _config: IExplorerConfig;
    private _roots: ExplorerNode[] = [];

    private _onDidChangeTreeData = new EventEmitter<ExplorerNode>();
    public get onDidChangeTreeData(): Event<ExplorerNode> {
        return this._onDidChangeTreeData.event;
    }

    constructor(
        public readonly context: ExtensionContext,
        readonly explorerCommands: ExplorerCommands,
        public readonly git: GitService
    ) {
        // TODO: HACK ATTACK!
        resultsExplorer = this;

        commands.registerCommand('gitlens.resultsExplorer.refresh', this.refreshNodes, this);
        commands.registerCommand('gitlens.resultsExplorer.refreshNode', this.refreshNode, this);
        commands.registerCommand('gitlens.resultsExplorer.setFilesLayoutToAuto', () => this.setFilesLayout(ExplorerFilesLayout.Auto), this);
        commands.registerCommand('gitlens.resultsExplorer.setFilesLayoutToList', () => this.setFilesLayout(ExplorerFilesLayout.List), this);
        commands.registerCommand('gitlens.resultsExplorer.setFilesLayoutToTree', () => this.setFilesLayout(ExplorerFilesLayout.Tree), this);

        commands.registerCommand('gitlens.resultsExplorer.clearResultsNode', this.clearResultsNode, this);
        commands.registerCommand('gitlens.resultsExplorer.close', this.close, this);
        commands.registerCommand('gitlens.resultsExplorer.setKeepResultsToOn', () => this.setKeepResults(true), this);
        commands.registerCommand('gitlens.resultsExplorer.setKeepResultsToOff', () => this.setKeepResults(false), this);

        setCommandContext(CommandContext.ResultsExplorerKeepResults, this.keepResults);

        context.subscriptions.push(
            configuration.onDidChange(this.onConfigurationChanged, this)
        );
        this.onConfigurationChanged(configuration.initializingChangeEvent);
    }

    private async onConfigurationChanged(e: ConfigurationChangeEvent) {
        const initializing = configuration.initializing(e);

        const section = configuration.name('resultsExplorer');
        if (!initializing && !configuration.changed(e, section.value)) return;

        const cfg = configuration.get<IExplorerConfig>(section.value);

        // if (initializing || configuration.changed(e, section('files')('layout').value)) {
        //     setCommandContext(CommandContext.GitExplorerFilesLayout, cfg.files.layout);
        // }

        if (!initializing && this._roots.length !== 0) {
            this.refresh(RefreshReason.ConfigurationChanged);
        }

        this._config = cfg;
    }

    get config(): IExplorerConfig {
        return this._config;
    }

    get keepResults(): boolean {
        return this.context.workspaceState.get<boolean>(WorkspaceState.ResultsExplorerKeepResults, false);
    }

    close() {
        this.clearResults();
        setCommandContext(CommandContext.ResultsExplorer, false);
    }

    async getChildren(node?: ExplorerNode): Promise<ExplorerNode[]> {
        if (this._roots.length === 0) return [new MessageNode('No results')];

        if (node === undefined) return this._roots;
        return node.getChildren();
    }

    async getTreeItem(node: ExplorerNode): Promise<TreeItem> {
        return node.getTreeItem();
    }

    getQualifiedCommand(command: string) {
        return `gitlens.resultsExplorer.${command}`;
    }

    async refresh(reason?: RefreshReason) {
        if (reason === undefined) {
            reason = RefreshReason.Command;
        }

        Logger.log(`ResultsExplorer.refresh`, `reason='${reason}'`);

        this._onDidChangeTreeData.fire();
    }

    refreshNode(node: ExplorerNode, args?: RefreshNodeCommandArgs) {
        Logger.log(`ResultsExplorer.refreshNode`);

        if (args !== undefined && node.supportsPaging) {
            node.maxCount = args.maxCount;
        }
        node.refresh();

        // Since a root node won't actually refresh, force everything
        this._onDidChangeTreeData.fire(this._roots.includes(node) ? undefined : node);
    }

    refreshNodes() {
        Logger.log(`ResultsExplorer.refreshNodes`);

        this._roots.forEach(n => n.refresh());

        this._onDidChangeTreeData.fire();
    }

    showCommitSearchResults(search: string, results: GitLog, queryFn: (maxCount: number | undefined) => Promise<GitLog | undefined>) {
        let cached: GitLog | undefined = results;
        const cachedQueryFn = (maxCount: number | undefined) => {
            if (cached !== undefined) {
                const promise = Promise.resolve(results);
                cached = undefined;

                return promise;
            }
            return queryFn(maxCount);
        };

        this.addResults(new SearchCommitsResultsNode(search, results.repoPath, cachedQueryFn, this));
        setCommandContext(CommandContext.ResultsExplorer, true);
    }

    private addResults(results: ExplorerNode): boolean {
        if (this._roots.includes(results)) return false;

        if (this._roots.length > 0 && !this.keepResults) {
            this.clearResults();
        }

        this._roots.splice(0, 0, results);
        this.refreshNode(results);
        return true;
    }

    private clearResults() {
        if (this._roots.length === 0) return;

        this._roots.forEach(r => r.dispose());
        this._roots = [];
    }

    private clearResultsNode(node: ExplorerNode) {
        const index = this._roots.findIndex(n => n === node);
        if (index === -1) return;

        this._roots.splice(index, 1);
        this.refresh();
    }

    private async setFilesLayout(layout: ExplorerFilesLayout) {
        return configuration.update(configuration.name('resultsExplorer')('files')('layout').value, layout, ConfigurationTarget.Global);
    }

    private setKeepResults(enabled: boolean) {
        this.context.workspaceState.update(WorkspaceState.ResultsExplorerKeepResults, enabled);
        setCommandContext(CommandContext.ResultsExplorerKeepResults, enabled);
    }
}