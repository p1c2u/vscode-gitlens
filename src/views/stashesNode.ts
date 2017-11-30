'use strict';
import { Iterables } from '../system';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { Explorer, ExplorerNode, MessageNode, ResourceType } from './explorerNode';
import { GitUri, Repository } from '../gitService';
import { StashNode } from './stashNode';

export class StashesNode extends ExplorerNode {

    constructor(
        uri: GitUri,
        private readonly repo: Repository,
        private readonly explorer: Explorer
    ) {
        super(uri);
    }

    async getChildren(): Promise<ExplorerNode[]> {
        const stash = await this.repo.getStashList();
        if (stash === undefined) return [new MessageNode('No stashed changes')];

        return [...Iterables.map(stash.commits.values(), c => new StashNode(c, this.explorer))];
    }

    getTreeItem(): TreeItem {
        const item = new TreeItem(`Stashes`, TreeItemCollapsibleState.Collapsed);
        item.contextValue = ResourceType.Stashes;

        item.iconPath = {
            dark: this.explorer.context.asAbsolutePath('images/dark/icon-stash.svg'),
            light: this.explorer.context.asAbsolutePath('images/light/icon-stash.svg')
        };

        return item;
    }
}