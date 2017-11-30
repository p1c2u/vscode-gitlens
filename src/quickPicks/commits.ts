'use strict';
import { Iterables } from '../system';
import { CancellationTokenSource, QuickPickOptions, window } from 'vscode';
import { GitLog, GitService } from '../gitService';
import { Keyboard, KeyNoopCommand } from '../keyboard';
import { CommandQuickPickItem, CommitQuickPickItem, getQuickPickIgnoreFocusOut, MessageQuickPickItem, showQuickPickProgress } from '../quickPicks';

export class CommitsQuickPick {

    static showProgress(message: string) {
        return showQuickPickProgress(message,
            {
                left: KeyNoopCommand,
                ',': KeyNoopCommand,
                '.': KeyNoopCommand
            });
    }

    static async show(git: GitService, log: GitLog | undefined, placeHolder: string, progressCancellation: CancellationTokenSource, goBackCommand?: CommandQuickPickItem, showInResultsExplorerCommand?: CommandQuickPickItem): Promise<CommitQuickPickItem | CommandQuickPickItem | undefined> {
        const items = ((log && [...Iterables.map(log.commits.values(), c => new CommitQuickPickItem(c))]) || [new MessageQuickPickItem('No results found')]) as (CommitQuickPickItem | CommandQuickPickItem)[];

        if (showInResultsExplorerCommand !== undefined) {
            items.splice(0, 0, showInResultsExplorerCommand);
        }

        if (goBackCommand !== undefined) {
            items.splice(0, 0, goBackCommand);
        }

        if (progressCancellation.token.isCancellationRequested) return undefined;

        const scope = await Keyboard.instance.beginScope({ left: goBackCommand });

        progressCancellation.cancel();

        const pick = await window.showQuickPick(items, {
            matchOnDescription: true,
            placeHolder: placeHolder,
            ignoreFocusOut: getQuickPickIgnoreFocusOut()
            // onDidSelectItem: (item: QuickPickItem) => {
            //     scope.setKeyCommand('right', item);
            // }
        } as QuickPickOptions);

        await scope.dispose();

        return pick;
    }
}