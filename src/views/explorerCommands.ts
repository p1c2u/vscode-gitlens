import { Arrays } from '../system';
import { commands, Disposable, ExtensionContext, InputBoxOptions, Terminal, TextDocumentShowOptions, Uri, window } from 'vscode';
import { ExtensionTerminalName } from '../constants';
import { BranchHistoryNode, ExplorerNode } from '../views/gitExplorer';
import { CommitFileNode, CommitNode, RemoteNode, StashNode, StatusUpstreamNode } from './explorerNodes';
import { Commands, DiffWithCommandArgs, DiffWithCommandArgsRevision, DiffWithPreviousCommandArgs, DiffWithWorkingCommandArgs, openEditor, OpenFileInRemoteCommandArgs, OpenFileRevisionCommandArgs } from '../commands';
import { GitService, GitUri } from '../gitService';

export interface RefreshNodeCommandArgs {
    maxCount?: number;
}

export class ExplorerCommands extends Disposable {

    private _disposable: Disposable | undefined;
    private _terminal: Terminal | undefined;

    constructor(
        public readonly context: ExtensionContext,
        public readonly git: GitService
    ) {
        super(() => this.dispose());

        commands.registerCommand('gitlens.explorers.openChanges', this.openChanges, this);
        commands.registerCommand('gitlens.explorers.openChangesWithWorking', this.openChangesWithWorking, this);
        commands.registerCommand('gitlens.explorers.openFile', this.openFile, this);
        commands.registerCommand('gitlens.explorers.openFileRevision', this.openFileRevision, this);
        commands.registerCommand('gitlens.explorers.openFileRevisionInRemote', this.openFileRevisionInRemote, this);
        commands.registerCommand('gitlens.explorers.openChangedFiles', this.openChangedFiles, this);
        commands.registerCommand('gitlens.explorers.openChangedFileChanges', this.openChangedFileChanges, this);
        commands.registerCommand('gitlens.explorers.openChangedFileChangesWithWorking', this.openChangedFileChangesWithWorking, this);
        commands.registerCommand('gitlens.explorers.openChangedFileRevisions', this.openChangedFileRevisions, this);
        commands.registerCommand('gitlens.explorers.applyChanges', this.applyChanges, this);
        commands.registerCommand('gitlens.explorers.terminalCheckoutBranch', this.terminalCheckoutBranch, this);
        commands.registerCommand('gitlens.explorers.terminalCreateBranch', this.terminalCreateBranch, this);
        commands.registerCommand('gitlens.explorers.terminalDeleteBranch', this.terminalDeleteBranch, this);
        commands.registerCommand('gitlens.explorers.terminalRebaseBranchToRemote', this.terminalRebaseBranchToRemote, this);
        commands.registerCommand('gitlens.explorers.terminalSquashBranchIntoCommit', this.terminalSquashBranchIntoCommit, this);
        commands.registerCommand('gitlens.explorers.terminalRebaseCommit', this.terminalRebaseCommit, this);
        commands.registerCommand('gitlens.explorers.terminalResetCommit', this.terminalResetCommit, this);
        commands.registerCommand('gitlens.explorers.terminalRemoveRemote', this.terminalRemoveRemote, this);
    }

     dispose() {
        this._disposable && this._disposable.dispose();
    }

     private async applyChanges(node: CommitNode | StashNode) {
        await this.git.checkoutFile(node.uri);
        return this.openFile(node);
    }

    private openChanges(node: CommitNode | StashNode) {
        const command = node.getCommand();
        if (command === undefined || command.arguments === undefined) return;

        const [uri, args] = command.arguments as [Uri, DiffWithPreviousCommandArgs];
        args.showOptions!.preview = false;
        return commands.executeCommand(command.command, uri, args);
    }

    private openChangesWithWorking(node: CommitNode | StashNode) {
        const args: DiffWithWorkingCommandArgs = {
            commit: node.commit,
            showOptions: {
                preserveFocus: true,
                preview: false

            }
        };
        return commands.executeCommand(Commands.DiffWithWorking, new GitUri(node.commit.uri, node.commit), args);
    }

    private openFile(node: CommitNode | StashNode) {
        return openEditor(node.uri, { preserveFocus: true, preview: false });
    }

    private openFileRevision(node: CommitNode | StashNode | CommitFileNode, options: OpenFileRevisionCommandArgs = { showOptions: { preserveFocus: true, preview: false } }) {
        return openEditor(options.uri || GitService.toGitContentUri(node.uri), options.showOptions || { preserveFocus: true, preview: false });
    }

    private async openChangedFileChanges(node: CommitNode | StashNode, options: TextDocumentShowOptions = { preserveFocus: false, preview: false }) {
        const repoPath = node.commit.repoPath;
        const uris = node.commit.fileStatuses
            .map(s => GitUri.fromFileStatus(s, repoPath));
        for (const uri of uris) {
            await this.openDiffWith(repoPath,
                { uri: uri, sha: node.commit.previousSha !== undefined ? node.commit.previousSha : GitService.deletedSha },
                { uri: uri, sha: node.commit.sha }, options);
        }
    }

    private async openChangedFileChangesWithWorking(node: CommitNode | StashNode, options: TextDocumentShowOptions = { preserveFocus: false, preview: false }) {
        const repoPath = node.commit.repoPath;
        const uris = Arrays.filterMap(node.commit.fileStatuses,
            f => f.status !== 'D' ? GitUri.fromFileStatus(f, repoPath) : undefined);
        for (const uri of uris) {
            await this.openDiffWith(repoPath, { uri: uri, sha: node.commit.sha }, { uri: uri, sha: '' }, options);
        }
    }

    private async openChangedFiles(node: CommitNode | StashNode, options: TextDocumentShowOptions = { preserveFocus: false, preview: false }) {
        const repoPath = node.commit.repoPath;
        const uris = Arrays.filterMap(node.commit.fileStatuses,
            f => f.status !== 'D' ? GitUri.fromFileStatus(f, repoPath) : undefined);
        for (const uri of uris) {
            await openEditor(uri, options);
        }
    }

    private async openChangedFileRevisions(node: CommitNode | StashNode, options: TextDocumentShowOptions = { preserveFocus: false, preview: false }) {
        const uris = Arrays.filterMap(node.commit.fileStatuses,
            f => f.status !== 'D' ? GitService.toGitContentUri(node.commit.sha, f.fileName, node.commit.repoPath, f.originalFileName) : undefined);
        for (const uri of uris) {
            await openEditor(uri, options);
        }
    }

    private async openDiffWith(repoPath: string, lhs: DiffWithCommandArgsRevision, rhs: DiffWithCommandArgsRevision, options: TextDocumentShowOptions = { preserveFocus: false, preview: false }) {
        const diffArgs: DiffWithCommandArgs = {
            repoPath: repoPath,
            lhs: lhs,
            rhs: rhs,
            showOptions: options
        };
        return commands.executeCommand(Commands.DiffWith, diffArgs);
    }

    private async openFileRevisionInRemote(node: CommitNode | StashNode) {
        return commands.executeCommand(Commands.OpenFileInRemote, new GitUri(node.commit.uri, node.commit), { range: false } as OpenFileInRemoteCommandArgs);
    }

    async terminalCheckoutBranch(node: ExplorerNode) {
        if (!(node instanceof BranchHistoryNode)) return;

        const command = `checkout ${node.branch.name}`;
        this.sendTerminalCommand(command, node.branch.repoPath);
    }

    async terminalCreateBranch(node: ExplorerNode) {
        if (!(node instanceof BranchHistoryNode)) return;

        const name = await window.showInputBox({
            prompt: `Please provide a branch name (Press 'Enter' to confirm or 'Escape' to cancel)`,
            placeHolder: `Branch name`,
            value: node.branch.remote ? node.branch.getName() : undefined
        } as InputBoxOptions);
        if (name === undefined || name === '') return;

        const command = `branch ${node.branch.remote ? '-t ' : ''}${name} ${node.branch.name}`;
        this.sendTerminalCommand(command, node.branch.repoPath);
    }

    terminalDeleteBranch(node: ExplorerNode) {
        if (!(node instanceof BranchHistoryNode)) return;

        const command = node.branch.remote
            ? `push ${node.branch.remote} :${node.branch.name}`
            : `branch -d ${node.branch.name}`;
        this.sendTerminalCommand(command, node.branch.repoPath);
    }

    terminalRebaseBranchToRemote(node: ExplorerNode) {
        if (node instanceof BranchHistoryNode) {
            if (!node.branch.current || !node.branch.tracking) return;

            const command = `rebase -i ${node.branch.tracking}`;
            this.sendTerminalCommand(command, node.branch.repoPath);
        }
        else if (node instanceof StatusUpstreamNode) {
            const command = `rebase -i ${node.status.upstream}`;
            this.sendTerminalCommand(command, node.status.repoPath);
        }
    }

    terminalSquashBranchIntoCommit(node: ExplorerNode) {
        if (!(node instanceof BranchHistoryNode)) return;

        const command = `merge --squash ${node.branch.name}`;
        this.sendTerminalCommand(command, node.branch.repoPath);
    }

    terminalRebaseCommit(node: ExplorerNode) {
        if (!(node instanceof CommitNode)) return;

        const command = `rebase -i ${node.commit.sha}^`;
        this.sendTerminalCommand(command, node.commit.repoPath);
    }

    terminalResetCommit(node: ExplorerNode) {
        if (!(node instanceof CommitNode)) return;

        const command = `reset --soft ${node.commit.sha}^`;
        this.sendTerminalCommand(command, node.commit.repoPath);
    }

    terminalRemoveRemote(node: ExplorerNode) {
        if (!(node instanceof RemoteNode)) return;

        const command = `remote remove ${node.remote.name}`;
        this.sendTerminalCommand(command, node.remote.repoPath);
    }

    private ensureTerminal(): Terminal {
        if (this._terminal === undefined) {
            this._terminal = window.createTerminal(ExtensionTerminalName);
            this._disposable = window.onDidCloseTerminal((e: Terminal) => {
                if (e.name === ExtensionTerminalName) {
                    this._terminal = undefined;
                    this._disposable!.dispose();
                    this._disposable = undefined;
                }
            }, this);

            this.context.subscriptions.push(this._disposable);
        }

        return this._terminal;
    }

    private sendTerminalCommand(command: string, cwd: string) {
        // let git = GitService.getGitPath();
        // if (git.includes(' ')) {
        //     git = `"${git}"`;
        // }

        const terminal = this.ensureTerminal();
        terminal.show(false);
        terminal.sendText(`git -C ${cwd} ${command}`, false);
    }
}