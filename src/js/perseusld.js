var PerseusLD;

PerseusLD = PerseusLD || {};

PerseusLD.results = { "passage": [], "text": [], "work": [], "artifact": [] };

/**
 * The PerseusLD query_md_annotations widget executes a simple SOV SPARQL 
 * query and populates the page with a sorted set of the results. The 
 * results are expected to be OA annotations which have one or more annotation 
 * targets uris and an inline annotation body composed of markdown text. 
 * 
 * To activate the widget add the following to the head of your html page:
 *   1. a <meta/> element with the id 
 *      persusld_SparqlEndpoint that identifies the location of the sparql 
 *      endpoint as the value of its content attribute. E.g.
 *
 *      <meta name='perseusld_SparqlEndpoint' 
 *            content="http://localhost:3030/ds/query?query="/>
 *
 *   2. links to the css/perseus_ld.css stylesheet and requirejs 
 *      javascript library as follows (replacing installpath with the path 
 *      at which the perseusld code is installed:
 *      <link href="installpath/src/css/perseusld.css"
 *            rel="stylesheet" type="text/css"/>
 *      <script data-main="installpath/src/js/config.js" 
 *              src="installpath/src/js/lib/requirejs/require.js"></script>
 *   3. an element with the following attributes:
 *        id perseusld_query_md_annotations  and
 *        data-activator: the css selector for a UI element to which 
 *                        the plugin will apply a click handler to show/hide 
 *                        the results. If no results are found it will be 
 *                        hidden.
 *        data-resourceurl: the base url at which the PerseusLD code is deployed
 *        data-serialization: a post-fix path to append to the annotation 
 *                            uri in the results to request a specific output 
 *                            format 
 *        data-pagemax: optional attribute to set maximum results to 
 *                      show on the page per result type
 *                      (the formatter must support paging)
 *        data-set: the uri of the data set to query 
 *        data-verb: the verb for the SPARQL query 
 *        data-formatter: the name of a javascript function 
 *                        (must be in the PerseusLD namespace)
 *                        to use to format the results. Two default 
 *                        functions are supplied with the widget:
 *                        PerseusLD.filter_text_annotations and 
 *                        PerseusLD.filter_artifact_annotations
 *                        the formatter should accept 2 arguments: 
 *                        the query element and the results array
 *        data-sbj: the css selector of an element containing the 
 *                  subject of the query
 *        data-sbjclass: the class of the subject 
 *                       (currently supported: 'text' and 'object')
 *        the widget expects a child element of the subject element 
 *        (as identified by @data-sbj) with 
 *        the RDF-A @resource attribute set to the URI of the object and the  
 *        RDFA-A @typeof attribute set to one of:
 * 
 *          http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object (for data-sbjclass=='object')
 *          or  
 *          http://www.cidoc-crm.org/cidoc-crm/E53_Place (for data-sbjclass=='object')
 *          or 
 *          http://lawd.info/ontology/ConceptualWork (for data-sbjclass=='text')
 *        
 *        For 'text' subjects, results may be filtered to more and less granular targets by including
 *        two additional optional elements with their @resource attributes set to their uris and 
 *        @typeof values set to one of the following. 
 *        
 *             http://lawd.info/ontology/WrittenWork 
 *             http://lawd.info/ontology/Citation
 * 
 *  The above element should contain the following required child elements:
 * 
 *     1. an element with the class perseusld_close to which a click handler 
 *        to hide the element will be applied.  
 *      
 *     2. an element with the classes perseusld_results and one of 
 *         perseusld_artifact  (all artifact results will be appended here)
 *         perseusld_work      (all conceptual work-level (i.e. lawd:ConceptualWork) results) 
 *         perseusld_text      (all version-specific (i.e. lawd:WrittenWork) results)
 *         perseusld_passage   (all passage-specific (i.e. lawd:Citation) results)
 * 
 */
PerseusLD.query_md_annotations  = function(a_query_elem) {

    // setup the transform
    PerseusLD.xslt_url = $(a_query_elem).attr("data-resourceurl") + "/xslt/oactohtml.xsl";

    var sbj_elemname = $($(a_query_elem).attr("data-sbj"));
    // look for a work as the subject
    var sbj_elem = $("*[typeof='http://lawd.info/ontology/ConceptualWork']",sbj_elemname);
    if (sbj_elem.length == 0) {
        // work not found, try for a man-made object 
        sbj_elem = $("*[typeof='http://www.cidoc-crm.org/cidoc-crm/E22_Man-Made_Object']",sbj_elemname);
    }
    if (sbj_elem.length == 0) {
        // work and man-made object not found, try for a place
        sbj_elem = $("*[typeof='http://www.cidoc-crm.org/cidoc-crm/E53_Place']",sbj_elemname);
    }
    if (sbj_elem.length == 0) {
        // okay, nothing found to query on, just return
    }
    
    // add the close handler
    $(".perseusld_close").click(function() { $(a_query_elem).hide();});
    // remove the uri prefix - let's work just with the URNs to keep it simple
    var queryuri = $("meta[name='perseusld_SparqlEndpoint']").attr("content");
    var verb = $(a_query_elem).attr("data-verb");
	var dataset = $(a_query_elem).attr("data-set");
	var formatter = $(a_query_elem).attr("data-formatter");
	var datatype = $(a_query_elem).attr("data-sbjclass");
	// need to use quote meta to escape the uri because it could contain regex protected chars like + 
    var sbj = "\\\\Q" + PerseusLD._strip_uri_prefix(sbj_elem.attr("resource")) + "\\\\E";   
    
    var dataset_query = "";
	if (dataset) {
	   dataset_query = "from <" + dataset + "> "
	}

    // retrieve all annotations from the requested set for this work
    // TODO eventually we will want to separate this out by annotation/collection type 
    // TODO sort by ?date
	if (queryuri && sbj && verb) {
    	   $.get(
    	           queryuri + encodeURIComponent( "select distinct ?annotation ?target ?who "+ dataset_query + 
    	               "where { ?annotation "  + "<"  + verb + "> ?target. FILTER regex(str(?target), \"" + sbj + "\"). ?annotation <http://www.w3.org/ns/oa#annotatedBy> ?who}") + "&format=json")
    	         .done( 
                    	   function(data) {
                    	       var results = [];
                    	       if (data.results.bindings.length > 0) {
                    	           jQuery.each(data.results.bindings, function(i, row) {
                    	               results.push(row);
                    	           })
                    	       }
                    	       PerseusLD[formatter]($(a_query_elem),results);
                    	   })
                 .fail(
    	                   function(){
    	                       if (window.console) { console.log("Error retrieving annotations"); }
    	                   }
    	         );
    }	
};

/**
 * filter_artifact_annotations
 * Just appends all of the results of the SPARQL query to the specific results element
 * @param a_elem the name of the parent element to contain the results 
 *        (expected to contain a child element with the class perseusld_results.perseusld_artifact)
 * @param a_results an array of results where each result is a JSON object with the following properties
 *      {
 *        "annotation" = { "value"="<annotationuri>", "type"="uri" },
 *        "target" = { "value"="<annotation target uri>", "type"="uri" },
 *        "who" = {"value"="<agent uri>", "type"="uri"}
 *      }
 *        
 */
PerseusLD.filter_artifact_annotations = function(a_elem,a_results) {
    var annotations = { "artifact": []};
    var activator = $(a_elem).attr("data-activator");
    var num_results = a_results.length;
	if (num_results == 0) {
	   $(a_elem).append('<p>No Annotations Found</p>').removeClass("loading");
	} else if(num_results > 0) {
		for (var i=0; i<num_results; i++) {
		  PerseusLD.results.artifact.push(a_results[i].annotation.value);
		}
	    $(activator).click(function() { PerseusLD._show_annotations('artifact',a_elem,0);});
	    $(activator).show();
    } else {
        // hide the button, just for good measure
        $(activator).hide();
    }
};

/**
 * filter_texts_annotations
 * Sorts the results of the SPARQL query into results which target the passage, the specific text and
 * the conceptual work and appends all the results of the SPARQL query to the specific results element.
 * Supports paging
 * @param a_elem the name of the parent element to contain the results 
 *        (expected to contain child elements with any of the following classes 
           perseusld_results.perseusld_work, perseusld_results.perseusld_text, perseusld_results.perseusld_passage)
 * @param a_results an array of results where each result is a JSON object with the following properties
 *      {
 *        "annotation" = { "value"="<annotationuri>", "type"="uri" },
 *        "target" = { "value"="<annotation target uri>", "type"="uri" },
 *        "who" = {"value"="<agent uri>", "type"="uri"}
 *      }
 *        
 */
PerseusLD.filter_text_annotations = function(a_elem,a_results) { 
    var activator = $(a_elem).attr("data-activator");
    var sbj_elem = $($(a_elem).attr("data-sbj"));
    var cts_work = $("*[typeof='http://lawd.info/ontology/ConceptualWork']",sbj_elem);
    var cts_text = $("*[typeof='http://lawd.info/ontology/WrittenWork']",sbj_elem);
    var cts_passage = $("*[typeof='http://lawd.info/ontology/Citation']",sbj_elem);
    var work_uri = PerseusLD._strip_uri_prefix(cts_work.attr("resource"));
    var text_uri = PerseusLD._strip_uri_prefix(cts_text.attr("resource"));
    var text_uri_regex = "^" + text_uri + "$";
    var work_uri_regex = "^" + work_uri + "$";
    var version_passage_start = null;
    var version_passage_end = null;
    var annotations = { "work": [], "text" : [], "passage" : []};
    
    // extract the starting passage of the displayed text version
    if (cts_passage.length > 0) {
        var passage_uri = PerseusLD._strip_uri_prefix(cts_passage.attr("resource"));
        var passage_regex = new RegExp("^" + text_uri + ":(.+)$");
        var passage_match = passage_regex.exec(passage_uri);
        if (passage_match != null) {
            var version_passage = passage_match[1];
            if (version_passage.match(/-/)) {
                var parts = version_passage.split(/-/);
                version_passage_start = parts[0];
                version_passage_end = parts[1];
            } else {
                version_passage_start = version_passage;
            }
        }
    }
    var num_results = a_results.length;
	if (num_results == 0) {
		$(a_elem).append('<p>No Annotations Found</p>').removeClass("loading");
	} else if(num_results > 0) {
		for (var i=0; i<num_results; i++) {
		  var target = PerseusLD._strip_uri_prefix(a_results[i].target.value);
		  if (target.match(new RegExp(work_uri_regex)) != null) {
              // the annotation is for the work as a whole
		      annotations.work.push(a_results[i].annotation.value);		      
		  }
		  else if (target.match(new RegExp(text_uri_regex)) != null) {
		      // the annotation is for the text as a whole
		      annotations.text.push(a_results[i].annotation.value);
		  } else if (version_passage_start != null) {
		      // extract the passage from the target
		      // compare passage from the target to see if it falls within the range of the shown passage
		      // passage matched can either be on the work as a whole or on this specific version
		      var target_passage = null;
		      var work_passage_regex = new RegExp("^" + work_uri + ":(.+)$");
		      var version_passage_regex = new RegExp("^" + text_uri + ":(.+)$");
              var work_passage_match = work_passage_regex.exec(target);
              var version_passage_match = version_passage_regex.exec(target);

              if (work_passage_match != null) {
                target_passage = work_passage_match[1];
              } else if (version_passage_match != null) {
                 target_passage = version_passage_match[1];
              }
              if (target_passage != null) {
                var target_passage_start = null;
                var target_passage_end = null;
                var range_match = target_passage.match(/^(.+?)-(.+)$/); 
                if ( range_match != null) {
                    // strip subrefs for now - check # and @ for backwards compatibility
                    target_passage_start = range_match[1].replace(/[@#].*$/, '');
                    target_passage_end = range_match[2].replace(/[@#].*$/, '');
                } else {
                     // no range - start and end are the same
                     // strip subrefs for now - check # and @ for backwards compatibility
                    target_passage_start = target_passage_end = target_passage.replace(/[@#].*$/, '');
                }
                if (target_passage_start >= version_passage_start &&
                        (version_passage_end == null || target_passage_end <= version_passage_end)) {
                    annotations.passage.push(a_results[i].annotation.value);
                }
              }
          }
		}
	}
	PerseusLD.results.passage = $.unique(annotations.passage);
	// Some annotations may target both an entire text and a specific passage so we need to dedupe - there's probably a better way to do this 
	PerseusLD.results.text = $.grep(annotations.text,function(a) { return $.inArray(a,PerseusLD.results.passage) == -1});
	// Some annotations may target a work, a text and a specific passage so we need to dedupe - there's probably a better way to do this
	PerseusLD.results.work = $.grep(annotations.work,function(a) { return $.inArray(a,PerseusLD.results.passage) == -1 && $.inArray(a,PerseusLD.results.text) == -1;});
    var hasPassage = PerseusLD.results.passage.length > 0;
    var hasText = PerseusLD.results.text.length > 0;
    var hasWork = PerseusLD.results.work.length > 0;
	if ( hasPassage || hasText || hasWork) {
	       $(activator).click(function() { 
	           if (hasPassage) { PerseusLD._show_annotations('passage',a_elem,0);}
	           if (hasText) { PerseusLD._show_annotations('text',a_elem,0); }
	           if (hasWork) { PerseusLD._show_annotations('work',a_elem,0); }
	           
	       }
	   );
	    $(activator).show();
    } else {
        // hide the button, just for good measure
        $(activator).hide();
    }
};

/**
 * Helper method called by filter_text_annotations and filter_artifact_annotations
 * to append results to the page. Results traversed from the PerseusLD.results object.
 * 
 * @param a_type the type of result target (i.e. 'artifact', 'text','work','passage')
 * @param a_elem the parent element to contain the results
 * @param a_start the starting index of the result
 */
PerseusLD._show_annotations = function(a_type,a_elem,a_start) {
    var activator = $(a_elem).attr("data-activator");
    var format = $(a_elem).attr("data-serialization");
    var max_results = $(a_elem).attr("data-pagemax");
    // if we haven't been given a paging max, show all the results
    if (! max_results || max_results == '') {
        max_results = PerseusLD.results[a_type].length;
    }
    if (a_start == 0) {
        // make sure we don't have any old results loaded
        $(".perseusld_results.perseusld_"+a_type,a_elem).children().remove();
    } else {
        // we've come from a click on the more button so remove it for now
        $(".perseusld_results.perseusld_"+a_type+" .more_annotations",a_elem).hide();
    }
    $(activator).addClass("clicked");
    $(".perseusld_results.perseusld_"+a_type,a_elem).addClass("loading");
    $(a_elem).show();
    var end = a_start + max_results -1;
    if (end > PerseusLD.results[a_type].length - 1) {
        end = PerseusLD.results[a_type].length - 1;
    }
    for (var i=a_start; i<=end; i++) {
        // flags to indicate if on last and if there are any more to show
        var next = null;
       	var last = ( i == end );
       	if (last && end < PerseusLD.results[a_type].length - 1) {
       	    next = end + 1;        
       	}
        	$.ajax(PerseusLD.results[a_type][i]+"/" + format,
       	    {
       	        type: 'GET',
       	        xhrFields: {data: {"last":last, "next":next, "type":a_type}},
       	        processData: false
       	    }).done(function(a_data,a_status,a_req) { 
       	        PerseusLD._transform_annotation(a_data,$(".perseusld_results.perseusld_"+a_type,a_elem),this.xhrFields.data);    
       	    }).fail(
       	        function(a_req) { 
       	            PerseusLD._fail_annotation($(".perseusld_results.perseusld_"+a_type,a_elem),this.xhrFields.data.last)
       	        }
       	    );
     }
}

/**
 * Helper method to strip the uri prefix from a CTS URN enabled URI
 * @param a_str the uri string
 * @returns the string with the uri prefix (everything up to urn:cts...) stripped
 *          if the uri doesn't contain a cts urn then it just returns the original string
 */
PerseusLD._strip_uri_prefix = function(a_str) {
    var stripped = a_str;
    var match = a_str.match("^https?://.*?/(urn:cts:.*)$");
    if (match != null) {
        stripped = match[1];
    }
    return stripped;
}

/**
 * Helper method for failed annotation retrieval, just removes the loading class if it's the last one
 * @param a_elem the results display element
 * @param a_is_last boolean flag to indicate if this is the last annotation to be retrieved
 */
PerseusLD._fail_annotation = function(a_elem,a_is_last) {
    if (a_is_last) {
        $(a_elem).removeClass("loading");
    }
}

/**
 * Helper method to transform an annotation using an XSLT transformation, initializing
 * the xslt processor first
 * @param a_xml the xml to transform
 * @param a_elem the element to hold the transformed output
 * @param a_options key value pairs 
 *      { 'last' : boolean flag to indicate if this is the last transformation,
 *        'next': int index of the next result,
 *        'type' : target type ('text','passage','work','artifact')
 *       } 
 */
PerseusLD._transform_annotation = function(a_xml,a_elem,a_opts) {
    // load the xslt processor if we haven't already)
    if ( PerseusLD.xslt_processor == null) {
        // TODO this transform should show the target if it's different than the passage
    	$.get(PerseusLD.xslt_url,
    	   function(a_data,a_status,a_req) {
    	       PerseusLD.xslt_processor = new XSLTProcessor();    
    	       PerseusLD.xslt_processor.importStylesheet(a_data);
    	       PerseusLD._add_annotation(PerseusLD.xslt_processor,a_xml,a_elem,a_opts);
    	   },
           'xml'
        );
    // otherwise just pass to _add_annotation
    } else {
        PerseusLD._add_annotation(PerseusLD.xslt_processor,a_xml,a_elem,a_opts);
    }
    
    
}

/**
 * Helper method to transform and add an annotation to the display
 * @param a_processor the xslt processor
 * @param a_xml the xml of the annotation
 * @param a_elem the element to hold the results
 * @param a_options key value pairs 
 *      { 'last' : boolean flag to indicate if this is the last transformation,
 *        'next': int index of the next result,
 *        'type' : target type ('text','passage','work','artifact')
 *       } 
 */
PerseusLD._add_annotation = function(a_processor,a_xml,a_elem,a_opts) {
    var html = a_processor.transformToDocument(a_xml);
    var node = document.importNode($('div',html).get(0));
    var converter = new Markdown.getSanitizingConverter();
    var textElem = $(".oac_cnt_chars",node).get(0);
    var ptext = converter.makeHtml($(textElem).html());
    $(textElem).html(ptext);
    $("*:first-child",textElem).addClass('perseusld_elided').click(PerseusLD._toggle_elided);
    a_elem.append(node);
    if (a_opts.last) {
        $(a_elem).removeClass("loading");
        if (a_opts.next != null) {
            $(a_elem).append("<button class=\"perseusld_more_annotations\">More</button>");
            $(".perseusld_more_annotations",a_elem).click(function() { $(this).remove(); PerseusLD._show_annotations(a_opts.type,$(a_elem).parent(),a_opts.next);});
        }
    }
}

/**
 * Helper method to toggle an elided result
 * toggles the "perseusld_fulltext" class to expand the elision
 */
PerseusLD._toggle_elided = function() {
    $(this).toggleClass('perseusld_fulltext');
}

/**
 * Helper method to randomly shuffle an array
 * Not currently in use - could be used for random ordering of results
 */
PerseusLD._shuffle = function(array) {
    'use strict';
    // from https://github.com/coolaj86/knuth-shuffle
    // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
    var currentIndex = array.length
      , temporaryValue
      , randomIndex
      ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
}
