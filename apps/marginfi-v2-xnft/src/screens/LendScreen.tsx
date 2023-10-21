import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { ExtendedBankInfo } from "@mrgnlabs/marginfi-v2-ui-state";
import { useRecoilValue } from "recoil";

import { tabActiveAtom } from "~/consts";
import { useMrgnlendStore } from "~/store/store";
import { useWallet } from "~/context/WalletContext";
import { useConnection } from "~/context/ConnectionContext";
import { SORT_OPTIONS_MAP, SortAssetOption, sortApRate, sortTvl } from "~/utils";
import tw from "~/styles/tailwind";
import config from "~/config";

import { Screen, Toggle } from "~/components/Common";
import { PoolCard, PoolCardSkeleton, Select, TabSwitch } from "~/components/Lend";

export function LendScreen() {
  const { wallet } = useWallet();
  const { connection } = useConnection();
  const [isStoreInitialized, marginfiClient, fetchMrgnlendState, selectedAccount, extendedBankInfos, nativeSolBalance] =
    useMrgnlendStore((state) => [
      state.initialized,
      state.marginfiClient,
      state.fetchMrgnlendState,
      state.selectedAccount,
      state.extendedBankInfos,
      state.nativeSolBalance,
    ]);
  const tabActive = useRecoilValue(tabActiveAtom);
  const [isFiltered, setIsFiltered] = useState(false);
  const [sortOption, setSortOption] = useState<SortAssetOption>(SORT_OPTIONS_MAP["TVL_DESC"]);
  const togglePositions = () => setIsFiltered((previousState) => !previousState);

  useEffect(() => {
    fetchMrgnlendState({ marginfiConfig: config.mfiConfig, connection, wallet: wallet ?? undefined }).catch(
      console.error
    );
    const id = setInterval(() => fetchMrgnlendState().catch(console.error), 30_000);
    return () => clearInterval(id);
  }, [wallet]); // eslint-disable-line react-hooks/exhaustive-deps
  // ^ crucial to omit both `connection` and `fetchMrgnlendState` from the dependency array
  // TODO: fix...

  const sortBanks = useCallback(
    (banks: ExtendedBankInfo[]) => {
      if (sortOption.field === "APY") {
        return sortApRate(banks, tabActive === "lend", sortOption.direction);
      } else if (sortOption.field === "TVL") {
        return sortTvl(banks, sortOption.direction);
      } else {
        return banks;
      }
    },
    [tabActive, sortOption]
  );

  const globalBanks = useMemo(() => {
    const filteredBanks =
      extendedBankInfos &&
      extendedBankInfos.filter((b) => !b.info.state.isIsolated).filter((b) => (isFiltered ? b.isActive : true));

    if (isStoreInitialized && sortOption && filteredBanks) {
      return sortBanks(filteredBanks);
    } else {
      return filteredBanks;
    }
  }, [isStoreInitialized, extendedBankInfos, sortOption, isFiltered, sortBanks]);

  const isolatedBanks = useMemo(() => {
    const filteredBanks =
      extendedBankInfos &&
      extendedBankInfos.filter((b) => b.info.state.isIsolated).filter((b) => (isFiltered ? b.isActive : true));

    if (isStoreInitialized && sortOption && filteredBanks) {
      return sortBanks(filteredBanks);
    } else {
      return filteredBanks;
    }
  }, [isStoreInitialized, extendedBankInfos, sortOption, isFiltered, sortBanks]);

  return (
    <Screen>
      <View style={tw`px-12px pb-24px pt-16px`}>
        <View style={tw`flex flex-column gap-16px`}>
          <View style={tw`flex-row justify-between`}>
            <TabSwitch />
          </View>
          <View style={tw`flex flex-row justify-between z-50`}>
            <View style={tw`flex flex-row gap-3 items-center`}>
              <Toggle isEnabled={isFiltered} toggleSwitch={togglePositions} />
              <Text style={tw`text-base font-light text-primary`}>Filter My positions</Text>
            </View>
            <Select selectedItem={sortOption} setSelectedItem={setSortOption} />
          </View>
          <Text style={tw`text-xl text-primary pl-12px`}>Global pool</Text>
          <View style={tw`flex flex-row flex-wrap gap-6 justify-center items-center`}>
            {extendedBankInfos.length > 0 ? (
              globalBanks.length > 0 ? (
                globalBanks.map((extendedBankInfo, idx) => (
                  <PoolCard
                    key={idx}
                    bankInfo={extendedBankInfo}
                    nativeSolBalance={nativeSolBalance}
                    isInLendingMode={tabActive === "lend"}
                    marginfiAccount={selectedAccount}
                    reloadBanks={async () => {
                      if (!connection) return;
                      fetchMrgnlendState({ marginfiConfig: config.mfiConfig, connection, wallet: wallet ?? undefined });
                    }}
                    marginfiClient={marginfiClient}
                  ></PoolCard>
                ))
              ) : (
                <Text style={tw`text-sm text-secondary pl-12px`}>No Global Pools Found</Text>
              )
            ) : (
              <PoolCardSkeleton />
            )}
          </View>

          <Text style={tw`text-xl text-primary pl-12px`}>Isolated pool</Text>
          <View style={tw`flex flex-row flex-wrap gap-6 justify-center items-center`}>
            {extendedBankInfos.length > 0 ? (
              isolatedBanks.length > 0 ? (
                isolatedBanks.map((extendedBankInfo, idx) => (
                  <PoolCard
                    key={idx}
                    bankInfo={extendedBankInfo}
                    nativeSolBalance={nativeSolBalance}
                    isInLendingMode={tabActive === "lend"}
                    marginfiAccount={selectedAccount}
                    reloadBanks={async () => {
                      if (!connection) return;
                      fetchMrgnlendState({ marginfiConfig: config.mfiConfig, connection, wallet: wallet ?? undefined });
                    }}
                    marginfiClient={marginfiClient}
                  ></PoolCard>
                ))
              ) : (
                <Text style={tw`text-sm text-secondary pl-12px`}>No Isolated Pools Found</Text>
              )
            ) : (
              <PoolCardSkeleton />
            )}
          </View>
        </View>
      </View>
    </Screen>
  );
}
