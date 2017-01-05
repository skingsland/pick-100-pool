(function () {
  angular.module('ui.grid').config(['$provide', function($provide) {
    $provide.decorator('i18nService', ['$delegate', function($delegate) {
      $delegate.add('no', {
        headerCell: {
          aria: {
            defaultFilterLabel: 'Filter for column',
            removeFilter: 'Remove Filter',
            columnMenuButtonLabel: 'Column Menu'
          },
          priority: 'Priority:',
          filterLabel: "Filter for column: "
        },
        aggregate: {
          label: 'items'
        },
        groupPanel: {
          description: 'Drag a column header here and drop it to group by that column.'
        },
        search: {
          placeholder: 'Search...',
          showingItems: 'Showing Items:',
          selectedItems: 'Selected Items:',
          totalItems: 'Total Items:',
          size: 'Page Size:',
          first: 'First Page',
          next: 'Next Page',
          previous: 'Previous Page',
          last: 'Last Page'
        },
        menu: {
          text: 'Choose Columns:'
        },
        sort: {
          ascending: 'Sort Ascending',
          descending: 'Sort Descending',
          none: 'Sort None',
          remove: 'Remove Sort'
        },
        column: {
          hide: 'Hide Column'
        },
        aggregation: {
          count: 'total rows: ',
          sum: 'total: ',
          avg: 'avg: ',
          min: 'min: ',
          max: 'max: '
        },
        pinning: {
          pinLeft: 'Pin Left',
          pinRight: 'Pin Right',
          unpin: 'Unpin'
        },
        columnMenu: {
          close: 'Close'
        },
        gridMenu: {
          aria: {
            buttonLabel: 'Grid Menu'
          },
          columns: 'Kolonner:',
          importerTitle: 'Importer fil',
          exporterAllAsCsv: 'Eksporter alle data som csv',
          exporterVisibleAsCsv: 'Eksporter synlige data som csv',
          exporterSelectedAsCsv: 'Eksporter utvalgte data som csv',
          exporterAllAsPdf: 'Eksporter alle data som pdf',
          exporterVisibleAsPdf: 'Eksporter synlige data som pdf',
          exporterSelectedAsPdf: 'Eksporter utvalgte data som pdf',
          clearAllFilters: 'Clear all filters'
        },
        importer: {
          noHeaders: 'Column names were unable to be derived, does the file have a header?',
          noObjects: 'Objects were not able to be derived, was there data in the file other than headers?',
          invalidCsv: 'File was unable to be processed, is it valid CSV?',
          invalidJson: 'File was unable to be processed, is it valid Json?',
          jsonNotArray: 'Imported json file must contain an array, aborting.'
        },
        pagination: {
          aria: {
            pageToFirst: 'Page to first',
            pageBack: 'Page back',
            pageSelected: 'Selected page',
            pageForward: 'Page forward',
            pageToLast: 'Page to last'
          },
          sizes: 'items per page',
          totalItems: 'items',
          through: 'through',
          of: 'of'
        },
        grouping: {
          group: 'Group',
          ungroup: 'Ungroup',
          aggregate_count: 'Agg: Count',
          aggregate_sum: 'Agg: Sum',
          aggregate_max: 'Agg: Max',
          aggregate_min: 'Agg: Min',
          aggregate_avg: 'Agg: Avg',
          aggregate_remove: 'Agg: Remove'
        }
      });
      return $delegate;
    }]);
  }]);
})();
