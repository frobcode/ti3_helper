
function _do_nothing(tech, distance)
{
    return distance;
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
    var current_distance = 0; // something small, as && is max
    for(var anded_sets_iter in current_tech.prerequisites)
    {
        // the strategy here is, for each set of values anded
        // together, our distance is 1 + the MAX.
        // but when values are OR'D together, the distance is the MIN
        var current_ord_set = current_tech.prerequisites[anded_sets_iter];
        var ord_set_distance = 1000000; // big, || is min
        for(var ord_sets_iter in current_ord_set)
        {
            var tech = current_ord_set[ord_sets_iter];
            var try_distance = 1 + get_tech_distance(tech, per_node_visit_function);
            if( try_distance < ord_set_distance )
                ord_set_distance = try_distance;
        }
        if( ord_set_distance > current_distance )
            current_distance = ord_set_distance;
    }

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
        tech.available = false;
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
                target_tech.makes_available.push(techname);
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
        var is_avail = is_tech_available(tech);
        tech.available = is_avail;
        tech.have = tech.have && is_avail;
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

