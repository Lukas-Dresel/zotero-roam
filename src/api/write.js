import { useMutation, useQueryClient } from "react-query";
import { deleteTags, writeCitoids, writeItems } from "./utils";
import { emitCustomEvent } from "../events";

/** Delete tags from a Zotero library
 * @fires zotero-roam:write
 * @returns 
 */
const useDeleteTags = () => {
	let client = useQueryClient();

	return useMutation((variables) => {
		const { library: { apikey, path }, tags } = variables;
		let { lastUpdated: version } = client.getQueryData(["tags", { apikey, library: path }]);

		return deleteTags(tags, { apikey, path }, version);
	}, {
		onSettled: (data, error, variables, _context) => {
			const { library: { path }, tags } = variables;

			if(!error){
				// Invalidate item queries related to the library used
				// Data can't be updated through cache modification because of the library version
				client.invalidateQueries([ "items", path ], {
					refetchInactive: true
				});
			}

			emitCustomEvent("write", {
				data,
				error,
				library: path,
				tags
			});
		}
	});
};

/** Import items generated by the Wikipedia Citoid API to Zotero
 * @fires zotero-roam:write
 * @returns 
 */
const useImportCitoids = () => {
	let client = useQueryClient();

	return useMutation((variables) => {
		const { collections = [], items, library, tags = [] } = variables;
		return writeCitoids(items, { library, collections, tags});
	}, {
		onSettled: (data, error, variables, _context) => {
			const { collections, items, library: { path }, tags } = variables;

			if(!error){
				// Invalidate item queries related to the library used
				// Data can't be updated through cache modification because of the library version
				client.invalidateQueries([ "items", path ], {
					refetchInactive: true
				});	
			}

			emitCustomEvent("write", {
				collections,
				data: data.data,
				error,
				items,
				library: path,
				tags
			});
		}
	});
};

/** Modifies tags in a Zotero library
 * @fires zotero-roam:write
 * @returns
 */
const useModifyTags = () => {
	let client = useQueryClient();

	return useMutation((variables) => {
		const { into, library: { apikey, path }, tags } = variables;
		let dataList = [];
		let libItems = client.getQueriesData(["items", path])
			.map(query => (query[1] || {}).data || []).flat(1)
			.filter(i => !["attachment", "note", "annotation"].includes(i.data.itemType) && i.data.tags.length > 0);

		libItems.forEach(i => {
			let itemTags = i.data.tags;
			// If the item already has the target tag, with type 0 (explicit or implicit) - remove it from the array before the filtering :
			let has_clean_tag = itemTags.findIndex(i => i.tag == into && (i.type == 0 || !i.type));
			if (has_clean_tag > -1) {
				itemTags.splice(has_clean_tag, 1);
			}
			// Compare the lengths of the tag arrays, before vs. after filtering out the tags to be renamed
			let cleanTags = itemTags.filter(t => !tags.includes(t.tag));
			if (cleanTags.length < itemTags.length) {
				// If they do not match (aka, there are tags to be removed/renamed), insert the target tag & add to the dataList
				cleanTags.push({ tag: into, type: 0 });
				dataList.push({
					key: i.data.key,
					version: i.version,
					tags: cleanTags
				});
			}
		});

		return writeItems(dataList, { apikey, path });
	}, {
		onSettled: (data, error, variables, _context) => {
			const { into, library: { path }, tags } = variables;

			if(!error){
				// Invalidate item queries related to the library used
				// Data can't be updated through cache modification because of the library version
				client.invalidateQueries([ "items", path ], {
					refetchInactive: true
				});
			}

			emitCustomEvent("write", {
				data: data.data,
				error,
				into,
				library: path,
				tags
			});
		}
	});
};

export {
	useDeleteTags,
	useImportCitoids,
	useModifyTags
};