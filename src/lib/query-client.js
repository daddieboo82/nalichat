import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
			staleTime: 1000 * 60 * 2, // 2min — serve cached data instantly on tab switches, no refetch flicker
			gcTime: 1000 * 60 * 15, // keep cached data 15min so back-navigation is instant
			refetchOnReconnect: false,
		},
	},
});