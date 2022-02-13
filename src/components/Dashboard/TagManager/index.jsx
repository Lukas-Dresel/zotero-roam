import React, { useCallback, useContext, useMemo, useState } from "react";
import { arrayOf } from "prop-types";
import { Callout, Classes, Spinner, Tag } from "@blueprintjs/core";

import { ExtensionContext } from "../../App";
import { RoamTag } from "./Tags";
import TagsDatalist from "./TagsDatalist";

import { useQuery_Tags, useWriteableLibraries } from "../../../api/queries";
import * as customPropTypes from "../../../propTypes";

// TODO: Convert to globally accessible constant
const NoWriteableLibraries = <Callout>No writeable libraries were found. Please check that your API key(s) have the permission to write to at least one of the Zotero libraries you use. <a href="https://app.gitbook.com/@alix-lahuec/s/zotero-roam/getting-started/prereqs#zotero-api-credentials" target="_blank" rel="noreferrer">Refer to the extension docs</a> for more details.</Callout>;

const TabContents = React.memo(function TabContents(props){
	const { libraries } = props;
	const [selectedLibrary, setSelectedLibrary] = useState(libraries[0]);

	const { isLoading, data } = useQuery_Tags([selectedLibrary], { 
		notifyOnChangeProps: ["data"], 
		select: (datastore) => datastore.data
	})[0];
	
	const libOptions = useMemo(() => libraries.map(lib => lib.path), [libraries]);
	const handleLibrarySelect = useCallback((path) => setSelectedLibrary(libraries.find(lib => lib.path == path)), [libraries]);
	const libProps = useMemo(() => {
		return {
			currentLibrary: selectedLibrary,
			onSelect: handleLibrarySelect,
			options: libOptions
		};
	}, [handleLibrarySelect, libOptions, selectedLibrary]);

	return (
		<>
			<div className={["zr-tagmanager--header", "zr-auxiliary"].join(" ")}>
                Rename, merge, and delete tags between <RoamTag text="Roam" /> and <Tag active={true} className={["zr-tag--zotero", Classes.ACTIVE, Classes.MINIMAL].join(" ")}>Zotero</Tag>
			</div>
			<div className="zr-tagmanager--datalist">
				{isLoading
					? <Spinner />
					: <TagsDatalist items={data} libProps={libProps} /> }
			</div>
		</>
	);
});
TabContents.propTypes = {
	libraries: arrayOf(customPropTypes.zoteroLibraryType)
};

const TagManager = React.memo(function TagManager(){
	const { libraries } = useContext(ExtensionContext);
	const { data: writeableLibraries, isLoading } = useWriteableLibraries(libraries);

	return (
		isLoading
			? <Spinner />
			: writeableLibraries.length == 0
				? <NoWriteableLibraries />
				: <TabContents libraries={writeableLibraries} />
	);
});
TagManager.propTypes = {
	
};

export default TagManager;
