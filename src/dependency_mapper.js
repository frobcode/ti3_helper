
function _do_nothing(tech, distance)
{
    return distance;
}

function update_availability(tech, callback_on_affected)
{
    if( ! callback_on_affected ) {
        callback_on_affected = function() { return; };
    }
    var state = Object();
    state.visited = Object();
    state.visitcount = 0;
    state.callback_on_tech = callback_on_affected;

    visit_graph(tech, update_available_visitor, state);
    // just update the client when everything is settled...
    for(var all_visited in state.visited)
    {
        var updated_tech = state.visited[all_visited];
        callback_on_affected(updated_tech);
    }
}

function update_available_visitor(tech, state)
{
    // this should only be called UPWARD, but we can have situation that
    // C relies on A OR B and B relies on A so we need to check C from A,
    // and ALSO C from B, so this means C gets multiple visits.  Kinda gross
    // but that's what you get with multipath.
    if( state.visitcount > 1000 )
    {
        // anti-loop check; hope 1000 is enough
        alert("Hit loop check; further operations precluded")
        return [];
    }

    var available = is_tech_available(tech); // cheaper than distance!
    var old_have = tech.have;
    tech.have = tech.have && available; // if our prereqs have been fribbled, we should change too.
    var old_dist = tech.distance;
    var new_dist = get_tech_distance(tech);
    var needed_update = false;
    if( new_dist != old_dist )
    {
        needed_update = true;
    }
    tech.distance = new_dist;
    if( old_have != tech.have )
    {
        needed_update = true;
    }
    state.visited[tech.sn] = tech;
    state.visitcount++;
    return tech.makes_available;
}

function get_path_to(tech, on_each_path )
{
    // find the path to a given tech, given the current state of the tree
    var state = Object();
    state.callback=function(somestate) { on_each_path(somestate.path) };
    state.path=[];
    state.old_path = [];
    get_pathing_visitor(tech, state);
}

function concat_arrays(obj1, obj2)
{
    resultobj = [];
    for(var iter1 in obj1)
    {
        resultobj.push(obj1[iter1]);
    }
    for(var iter2 in obj2)
    {
        resultobj.push(obj2[iter2]);
    }
    return resultobj;
}

function pathing_helper(visiting_tech, callback)
{
    // call the pathing helper with a given node, and a callback.
    // What it should do is call the callback, with a list of dependents, with itself at the end.
    // So if a depends on b (a->b) ->c...
    // calling this on a will result in f(a) calling f(b) resulting in f(c) which will call back with [c], which goes up to b
    // which adds itself to the list and calls up with [c, b] which calls into a which will then call ITS callback with [c,b,a]

    if( visiting_tech == null || visiting_tech.have )
    {
        callback([]);
        return;
    }
    if(length(visiting_tech.prerequisites) == 0 )
    {
        // there are no prerequisites, so just callback with ourselves.
        callback([visiting_tech];
        return;
    }
    for(var prereq in visiting_tech.prerequisites)
    {
        pathing_helper(prereq, function(rcvd_list) {
            rcvd_list.push(visiting_tech);
            callback(rcvd_list);
        }
    }

}


function get_pathing_visitor( visiting_tech, state)
{
    // this should return a list of prerequisites to visit.
    // if we HAVE this, we return []
    if( visiting_tech.have )
    {
        return [];
    }
    if(is_tech_available(visiting_tech) )
    {
        // also, don't need to visit anything, but we add ourselves to the path...
        state.path.push(visiting_tech);
        state.callback(state);
        return [];
    }
    // otherwise, for each 'or' we need to bifurcate the path, and call visit_graph for that  
    // This requires iterating through all the combinations of 'ors'.  In our case, it's always
    // at most 2 I think, but hey; why be constrained?
    var continuing_states = [];
    // let's build some motherfucking combos.
    var counter_array = [];
    var counter_rollover_values = [];
    for(var prereq_counter in visiting_tech.prerequisites)
    {
        counter_array.push(0); // we start at 0
        var ord_set_size = visiting_tech.prerequisites[prereq_counter].length
        counter_rollover_values.push(ord_set_size);
    }
    var carry = 0;
    while(carry == 0)
    {
        var new_state = Object();
        new_state.path = [];
        new_state.callback = function(newstate) { 
            newstate.path = concat_arrays(newstate.path, state.path);
            newstate.path.push( visiting_tech );
            // close over the existing state, to capture the callback
            alert("Calling back from " + visiting_tech.fn);
            state.callback( newstate);
        }
        for(var counter_iter in counter_array)
        {
            var tech_to_visit = visiting_tech.prerequisites[counter_iter][counter_array[counter_iter]];
            alert("About to visit " + tech_to_visit.fn);
            visit_graph(tech_to_visit, get_pathing_visitor, new_state);
        }
        // now increment the counters, left-to-right
        carry = 1;
        for(var counter_iter in counter_array)
        {
            counter_array[counter_iter] += carry;
            carry = 0;
            if( counter_array[counter_iter] >= counter_rollover_values[counter_iter])
            {
                counter_array[counter_iter] = 0;
                carry = 1;
            }
        }
        // if the carry remained one, that means everything rolled over, so we should be done
    }

    return []; // we never want visit_graph to do its own thing
}

function visit_graph(node, callback_on_node, state)
{
    // visit a node, by calling a callback with that node, 
    // plus opaque state, which can return a list of nodes which will be
    // then recursively visited.
    var returned_set = callback_on_node(node, state);
    for(var set_iter in returned_set)
    {
        var new_node = returned_set[set_iter];
        visit_graph(new_node, callback_on_node, state);
    }
}

function get_tech_distance(current_tech, per_node_visit_function )
{
    if( ! per_node_visit_function )
    {
        per_node_visit_function = function() { return; } ;
    }
    if( current_tech.have )
    {
        // distance is 0; we HAVE it!
        per_node_visit_function(current_tech, 0);
        return 0;
    }

    if( current_tech.prerequisites.length == 0 )
    {
        // we don't have it (above test), but we can get it in 1, 
        // since it has no prereqs
        per_node_visit_function(current_tech, 1);
        return 1;
    }

    // otherwise, we need to run through!
    var current_distance = 0; // && means ADD DISTANCES
    for(var anded_sets_iter in current_tech.prerequisites)
    {
        // the strategy here is, for each set of values anded
        // together, our distance is SUM.
        // but when values are OR'D together, the distance is the MIN
        var current_ord_set = current_tech.prerequisites[anded_sets_iter];
        var ord_set_distance = 1000000; // big, || is min
        for(var ord_sets_iter in current_ord_set)
        {
            var tech = current_ord_set[ord_sets_iter];
            var try_distance = get_tech_distance(tech, per_node_visit_function);
            if( try_distance < ord_set_distance )
                ord_set_distance = try_distance;
        }
        if( ord_set_distance > current_distance )
            current_distance += ord_set_distance;
    }
    current_distance +=1; // plus one to get ourselves.
    per_node_visit_function(current_tech, current_distance);
    return current_distance;
}


          
// this is a big ole directed graph.  So things like 'how do I get to X' should be a simple matter of 
// graph traversal
function create_tech_tree(tech_tree_desc)
{
    var bigIndex = Object();
    for(var counter in tech_tree_desc)
    {
        // first, let's build the big list
        var tech = tech_tree_desc[counter];
        var shortName = tech.sn;
        tech.makes_available=[]; // the set of techs that this tech helps allow
        tech.have = false;
        tech.distance = 99;
        tech.tree = bigIndex;
        bigIndex[shortName]=tech;
        // done!  easy.
    }
    // now build the set of techs made available by any particular tech
    // the way the prereq list works is that it is an array of arrays.
    // each inner array is a set of 'or'd values.  Each inner array is anded with the others.
    // so War Suns, which need deep space cannon AND sarween tools == [[dsc],[st]]
    for(var techname in bigIndex)
    {
        var we_depend_on = bigIndex[techname];
        prereqs = we_depend_on.pr;
        var resolved_prereqs = [];
        for(var anded_conditions in prereqs)
        {
            var resolved_ord_set = [];
            ord_condition_set = prereqs[anded_conditions];
            for( var ord_condition_counter in ord_condition_set)
            {
                target_techname = ord_condition_set[ord_condition_counter];
                target_tech = bigIndex[target_techname];
                target_tech.makes_available.push(we_depend_on);
                resolved_ord_set.push( target_tech );
            }
            resolved_prereqs.push(resolved_ord_set);
        }
        we_depend_on.prerequisites=resolved_prereqs;
    }
    set_availables(bigIndex);

    return bigIndex;
}

function set_availables(with_techtree)
{
    for(var counter in with_techtree)
    {
        var tech = with_techtree[counter];
        var currentlyhave = tech.have;
        tech.have = false;
        var distance = get_tech_distance(tech);
        tech.distance = distance;
        tech.have = currentlyhave && (distance < 2);
    }
}

function techs_we_have(bigIndex)
{
    var techs = [];
    for( var counter in bigIndex)
    {
        if(bigIndex[counter].have) {
            techs.push(bigIndex[counter]);
        }
    }
    return techs;
}

// this function will call the callback for the tech itself, and each of its prereqs
function traverse_prerequisites(starting_tech, callback_per_tech)
{
    var result;
}

// Find the techs that we require in order to get the named tech.  'or' techs for
// which you do not have any of the prereqs are given in an array as well
// return an array of prerequisites, with 'or' being put in a group
function find_outstanding_requirements(tech)
{
    var required = [];
    var prereqs = tech.prereqs;
    for(var and_list_counter in prereqs)
    {
    }
}
        
// this will tell you how to get to tech X, from where you are.
// Due to 'or', there may be multiple paths.  So this calls a callback
// each time it finds a path, starting from the tech you want, and ending just before the tech you have.
// The path is provided in the form of an array of techs.
// Calling this on a tech you have returns you an empty array.
function want_tech(tech, on_completed_path)
{
    var current_path = [];
    var finder_context = create_finder_context([], [tech], Object());
    return _tech_path(finder_context, on_completed_path);
}

function create_finder_context(current_path, remaining_to_visit, visited)
{
    var ctx = Object();
    ctx.path = cloneObj(current_path);
    ctx.to_visit = cloneObj(remaining_to_visit);
    ctx.visited = cloneobj(visited);
    ctx.clone = function() {
        return create_finder_context(this.path, this.to_visit, this.visited);
    }
    return finder;
}

function cloneObj(o)
{
    var theClone = Object();
    for(prop in o)
    {
        theClone.prop = o.prop;
    }
}

function _tech_path(ctx,  on_completed_path)
{
    if(ctx.to_visit.length == 0 )
    {
        return on_completed_path(ctx.path);
    }

    var visiting_now = ctx.to_visit.pop(); 
    // it is possible to queue up a bunch of nodes that will have been visited, but weren't
    // when they were queued.  Grrr argh.
    while(ctx.to_visit.length > 0 && ctx.visited[visiting_now.sn] )
    {
        visiting_now = ctx.to_visit.pop();
    }

    if( ctx.visited[visiting_now.sn] ){
        return on_completed_path(ctx.path);
    }

    ctx.path.push(visiting_now);
    // we have visited this, in this context...
    ctx.visited[visiting_now.sn] = visiting_now;

    // deadly loop check...
    if(current_path.length > 500 )
    {
        on_completed_path([]);
    }

    // now generate all the various paths we can go, and do them as separate contexts

    var path_counters = [];
    var path_maxes =[];
    // in the case of 'and', two things need to be added to the list, plus the
    // prereqs of those things.
    // In the case of 'or', you need to add ONE, and then do that one, then the OTHER, and do that.
    // in fact, if you have sets 1,2,3 of size s1 s2 and s3, you have s1*s2*s3 different paths.
    for(var anded_set_counter in current_tech.prereqs)
    {
        path_counters.push(0);
        ord_set_max = current_tech.prereqs[anded_set_counter].length;
        path_maxes.push(ord_set_max);
    }
    // we will quit when we try to roll over the last one.
    
    // so first, we always want to call with our reduced context... it may finish us out, if 
    // we just did that last visit
    _tech_path(ctx, on_completed_path);
    while(path_counters[path_counters.length-1] < path_maxes[path_counters.length-1])
    {
        var new_ctx = ctx.clone();
        for(var index in current_tech.prereqs)
        {
            var to_push = current_tech.prereqs[index][path_counter[index]];
            if( !ctx.visited[to_push])
            {
                new_ctx.to_visit.push(to_push);
            }
        }
        _tech_path(new_ctx, on_completed_path);
        for(var index in path_counters)
        {
            // increment the counters, leftmost first
            path_counter[index] += 1;
            if( path_counter[index] < path_maxes[index] )
                break;
        }
    }
}




function tech_prereq_audit(tech, broken_prereqs_callback)
{
    // traverse the prerequisite graph, checking to see if we have the 
    // requisite techs!
    for( var anded_set_counter in prereqs)
    {
        or_set = prereqs[anded_set_counter];
        or_flag = false;
        for(var or_set_counter in or_set) {
            var tech = or_set[or_set_counter];
            if( tech.have ) {
                var really = tech_prereq_audit(tech, broken_prereqs_callback);
                if(really) {
                    or_flag = true;
                    break;
                }
            }
        }
        if( ! or_flag )
        {
            // somehow we have broken the prereqs, 
            // set the 'have' to the result of the callback
            tech.have = broken_prereqs_callback(tech);
        }
    }
}

function is_tech_available(tech)
{
    // this will tell us if a tech is available.
    var prereqs = tech.prerequisites;
    var in_and_set = true;
    for( var anded_set_counter in prereqs)
    {
        var or_set = prereqs[anded_set_counter];
        var in_or_set = false;
        for( var or_set_counter in or_set)
        {
            if( or_set[or_set_counter].have )
            {
                in_or_set = true;
                break;
            }
        }
        // if there was one missing from the set, then...
        if(! in_or_set )
        {
            return false;
        }
    }
    return in_and_set;
}

function prereqs_as_string(tech)
{
    // return a string with the prerequisites.
    var toReturn = "";
    var and_sep = "";
    for( anded_set_counter in tech.prerequisites)
    {
        toReturn = toReturn + and_sep;
        var or_set = tech.prerequisites[anded_set_counter];
        var or_sep = "";
        for( var or_set_iter in or_set)
        {
            var prereq = or_set[or_set_iter];
            toReturn = toReturn + or_sep + prereq.fn;
            or_sep=" or ";
        }
        and_sep = ", ";
    }
    return toReturn;
}


