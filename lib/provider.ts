import { channelProvider } from '@statechannels/iframe-channel-provider';
import { ChannelClient } from "@statechannels/channel-client"

async function provider(options: any) {
    await channelProvider.mountWalletComponent(
        'https://xstate-wallet-v-0-3-0.statechannels.org'
    );
    await channelProvider.enable();
    let cc = new ChannelClient(channelProvider)

    // cc.
}
