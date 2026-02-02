<script lang="ts">
    import {applyToFile, type CriticMarkupRangeEntry, SuggestionType} from "../../../editor/base";
    import {Button} from "../../components";
    import CommentatorPlugin from "../../../main";
    import {Menu} from "obsidian";
    import {applyRangeEditsToVault, openNoteAtRangeEntry} from "../../../editor/uix";

    interface Props {
        plugin: CommentatorPlugin;

        entry: CriticMarkupRangeEntry;

        menu_open?: boolean;
        moreOptionsMenu: (plugin: any, evt: MouseEvent, entries: CriticMarkupRangeEntry[]) => Menu;
    }

    let {
        plugin,

        entry,

        menu_open = $bindable(false),
        moreOptionsMenu,
    }: Props = $props();
</script>

<div style="position: relative">
	<div class="cmtr-view-suggestion-buttons">
		{#if entry.range.type === SuggestionType.COMMENT}
			{#if entry.range.replies.length}
				<Button
                    icon="message-square-off"
                    tooltip={"Delete comment thread"}
                    onClick={() => applyRangeEditsToVault(plugin, [entry], (app, file, ranges) => applyToFile((range, _) => range.accept(), app, file, ranges, false), true)}
				/>
			{:else}
				<Button
                    icon="cross"
                    tooltip={"Delete comment"}
                    onClick={() => applyRangeEditsToVault(plugin, [entry], (app, file, ranges) => applyToFile((range, _) => range.accept(), app, file, ranges, false), true)}
				/>
			{/if}

		{:else if entry.range.type !== SuggestionType.HIGHLIGHT}
			<Button
                icon="check"
                tooltip={"Accept change" + (entry.range.replies.length && plugin.settings.remove_comments_on_accept ? " (and delete thread)" : "")}
                onClick={() => applyRangeEditsToVault(plugin, [entry], (app, file, ranges) => applyToFile((range, _) => range.accept(), app, file, ranges, plugin.settings.remove_comments_on_accept), false)}
			/>
			<Button
                icon="cross"
                tooltip={"Reject change" + (entry.range.replies.length && plugin.settings.remove_comments_on_accept ? " (and delete thread)" : "")}
                onClick={() => applyRangeEditsToVault(plugin, [entry], (app, file, ranges) => applyToFile((range, _) => range.reject(), app, file, ranges, plugin.settings.remove_comments_on_accept), false)}
			/>
		{/if}

		<div class="cmtr-view-suggestion-button-sep"></div>


		<Button
            icon="eye"
            tooltip="View in note"
            onClick={async () => { await openNoteAtRangeEntry(plugin, entry) }}
		/>

		<Button
            icon="more-vertical"
            tooltip="More options"
            onClick={(evt) => {
                menu_open = true;
                const menu = moreOptionsMenu(plugin, evt, [entry]);
                menu.onHide(() => { menu_open = false });
            }}
		/>
	</div>
</div>
