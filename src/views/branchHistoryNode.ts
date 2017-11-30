'use strict';
import { Iterables } from '../system';
import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { CommitNode } from './commitNode';
import { GlyphChars } from '../constants';
import { Explorer, ExplorerNode, MessageNode, ResourceType, ShowAllNode } from './explorerNode';
import { GitBranch, GitUri } from '../gitService';

export class BranchHistoryNode extends ExplorerNode {

    readonly supportsPaging: boolean = true;

    constructor(
            public readonly branch: GitBranch,
            uri: GitUri,
            private readonly explorer: Explorer
        ) {
            super(uri);
        }

        async getChildren(): Promise<ExplorerNode[]> {
            const log = await this.explorer.git.getLogForRepo(this.uri.repoPath!, this.branch.name, this.maxCount);
            if (log === undefined) return [new MessageNode('No commits yet')];

            const children: (CommitNode | ShowAllNode)[] = [...Iterables.map(log.commits.values(), c => new CommitNode(c, this.explorer, this.branch))];
            if (log.truncated) {
                children.push(new ShowAllNode('Show All Commits', this, this.explorer));
            }
            return children;
        }

        async getTreeItem(): Promise<TreeItem> {
            let name = this.branch.getName();
            if (!this.branch.remote && this.branch.tracking !== undefined && this.explorer.config.showTrackingBranch) {
                name += ` ${GlyphChars.Space}${GlyphChars.ArrowLeftRight}${GlyphChars.Space} ${this.branch.tracking}`;
            }
            const item = new TreeItem(`${this.branch!.current ? `${GlyphChars.Check} ${GlyphChars.Space}` : ''}${name}`, TreeItemCollapsibleState.Collapsed);

            if (this.branch.remote) {
                item.contextValue = ResourceType.RemoteBranchHistory;
            }
            else if (this.branch.current) {
                item.contextValue = !!this.branch.tracking
                    ? ResourceType.CurrentBranchHistoryWithTracking
                    : ResourceType.CurrentBranchHistory;
            }
            else {
                item.contextValue = !!this.branch.tracking
                    ? ResourceType.BranchHistoryWithTracking
                    : ResourceType.BranchHistory;
            }

            let iconSuffix = '';
            if (this.branch.tracking) {
                if (this.branch.state.ahead && this.branch.state.behind) {
                    iconSuffix = '-yellow';
                }
                else if (this.branch.state.ahead) {
                    iconSuffix = '-green';
                }
                else if (this.branch.state.behind) {
                    iconSuffix = '-red';
                }
            }

            item.iconPath = {
                dark: this.explorer.context.asAbsolutePath(`images/dark/icon-branch${iconSuffix}.svg`),
                light: this.explorer.context.asAbsolutePath(`images/light/icon-branch${iconSuffix}.svg`)
            };

            return item;
        }
    }
