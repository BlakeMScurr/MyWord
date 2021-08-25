<script lang="ts">
    var exports = {}; // fixes a weird bug caused by the dynamic import as per https://stackoverflow.com/a/46887516
    import { onMount } from "svelte";
    import type { ChannelClient } from "@statechannels/channel-client";
    
    enum States {
        waiting = 1,
        preconnect,
        connected,
    }
    let state = States.waiting;
    let channelClient: ChannelClient | null = null;

    onMount(async () => {
        // TODO: remove dynamic import
        // SSR of the iframe-channel-provider isn't going to work without it being refactored as it uses window everywhere
        // We can avoid the immediate mounting by installing a sub module (channel-provider),
        // but the logger infests the whole package (it's required by channel-provider, and at least on of channel-provider's deps)
        // and it looks for window on install
        // Attempt to either get it refactored, or disable svelte's SRR as per https://github.com/sveltejs/kit/tree/master/packages/adapter-static#spa-mode
        let providerModule = await import('@statechannels/iframe-channel-provider');
        await window.channelProvider.mountWalletComponent(
            'https://xstate-wallet-v-0-3-0.statechannels.org'
        );
        state = States.preconnect
    })
    
    async function connect() {
        await window.channelProvider.enable();
        state = States.connected
    }
</script>

{#if state === States.waiting }
    <h1>Waiting for statechannels.org wallet</h1>
{:else if state === States.preconnect }
    <button on:click={connect}>Connect to statechannels.org wallet</button>
{:else if state === States.connected }
    <h1>Connected to statechannels.org wallet</h1>
{/if}