[Changelog](https://glitch.com/edit/#!/iwill?path=CHANGELOG.md:1:0 )


[GitHub Issues](https://github.com/beeminder/iwill/issues )

# The I-Will System

Problem:
Alice casually says to Bob 
"I'll let you know if I can make it to the meeting"
or
"I'll see if I can reproduce that bug"
but then forgets to follow through.

Solution:
Any time Alice makes any 
"<a href="http://blog.beeminder.com/will">I will</a>" 
statement like that, she types a URL like so:

```
alice.promises.to/let_bob_know_re_meeting/by/tomorrow_5pm
```

As in, she literally types that directly to Bob, manually, when she's making the promise to him.
When Alice or Bob click that URL a promise is created in the promises.to app and a calendar entry is added to Alice's calendar and a datapoint is sent to Beeminder.

We actually have both the "promises.to" and "commits.to" domain names and you can use them interchangeably.

## Creation on GET

Creating an object in a database in response to a GET request is pretty unkosher. 
We've decided it's worth it because of how elegantly it reduces the friction for the user.
If/when that's abused we'll revisit this but initially we're making all tradeoffs in favor of lower friction.

Also it's a nice feature how every yourname.promises.to URL you type gets almost automatically logged as a promise.
We'll address spiders and such generating URLs you didn't type as they're a problem.

## Promise Data Structure

The fundamental object in the promises.to app is of course the promise aka the commitment.
The following are the database fields for the Promises table:

* `urtext`: full original text (URL) the user typed to create the promise
* `user`: who's making the promise, parsed as the subdomain in the urtext
* `slug`: unique identifier for the promise, parsed from the urtext URL
* `note`: optional additional notes or context for the promise
* `tini`: unixtime that the promise was made
* `tdue`: unixtime that the promise is due
* `tfin`: unixtime that the promise was (fractionally) fulfilled (even if 0%)
* `fill`: fraction fulfilled, default 0
* `firm`: true when the due date is confirmed and can't be edited again
* `void`: true if the promise became unfulfillable or moot
* `clix`: number of clicks a promise has gotten
* `bmid`: the id of the Beeminder datapoint for this promise

For example:

* `urtext` = "bob.promises.to/foo_the_bar/by/noon_tomorrow"
* `user` = "bob"
* `slug` = "foo_the_bar"
* `note` = "promised in slack discussion about such-and-such"
* `tini` = [unixtime of first GET request of the promise's URL]
* `tdue` = [what "noon tomorrow" parsed to at time tini]
* `tfin` = [unixtime that the user marked the promise as fulfilled]
* `fill` = 0
* `firm` = false
* `void` = false
* `clix` = 0
* `bmid` = 4f9dd9fd86f22478d3000007

Here are some other ideas for fields, that we can worry about as the project evolves:

* information about the client that originally created the promise
* whether the promise was created by the actual user (if they were logged in 
  and were the first to click on it) or by another logged-in user or by 
  someone not logged in

## Late Penalties

A big part of promises.to is tracking how reliable you are.
Like what fraction of the promises you logged did you actually fulfill?
If you fulfill a promise late you get partial credit.
That way we can always compute a single metric for your reliability at any moment in time.


The function we're using for late penalties is below.
The idea is to have your reliability decrease strictly monotonically the moment the deadline hits, with sudden drops when you're a minute, an hour, a day, etc, late.
(More on the rationale for that in lib/latepenalty.js.)
The following shows the remaining credit as a function of how late you are, first zoomed in to the first 60some seconds, and then zoomed out further and further:

[![Late penalty function](https://cdn.glitch.com/ff974d2d-e212-470e-8587-f065205350d0%2Flate-penalty.png?1507416292319 "Click for bigger version")](https://cdn.glitch.com/ff974d2d-e212-470e-8587-f065205350d0%2Flate-penalty.png)

## Beeminder integration

The idea is to 
[send a datapoint to Beeminder](http://beeminder.com/api) 
for each promise you make.
A Beeminder datapoint consists of a date, a value, and a comment.
Beeminder plots those cumulatively on a graph for you and lets you hard-commit to a certain rate of progress.

In the case of promises.to the date on the Beeminder datapoint will be the promise's deadline (even though it's in the future) and the value will be the fulfilled fraction (initially zero).
The comment should just have the promise's urtext since that's a link to all the data about a promise.
Or something like "Auto-added by promises.to at 12:34pm -- " and then the urtext link.

The Beeminder goal should be a do-more goal to fulfill, say, 8 promises per week.
The way I (dreev) do this currently: 
I create a datapoint for each promise (via IFTTT from Google Calendar) when I promise it, and then change the datapoint to a 1 when I fulfill it (or something less than 1 if I fulfill it late).

So Beeminder is not enforcing a success rate, just an absolute number of successes.

Pro tip: 
Promise a friend some things from your to-do list that you could do any time.
That way you're always ready for an I-will beemergency.

The promises.to app's interactions with Beeminder (via Beeminder API calls) are as follows:

1. When a promise is created, create a datapoint
2. When a promise is marked (partially fulfilled), update the datapoint's value
3. When a promise's due date changes, update the datapoint's date
4. [POST-MVP] When a promise is deleted, delete the datapoint
5. [POST-MVP] Create the initial Beeminder goal when a user signs up for promises.to

## Uniqueness of Promise Names

What should happen if alice says `alice.commits.to/send_the_report/by/thu` one week and then says `alice.commits.to/send_the_report/by/fri` the next week?

Answer: treat them as the same promise.
I.e., key on just `user`+`'/'`+`slug`.

In practice it seems to be easy to make an unlimited number of unique names for promises and if there's a collision it will be perfectly clear to the user why and what to do about it.

One thing to do about it is just let the user manually rename the old promise.
It's up to the user whether they're ok with any links to the old promise pointing at the new promise.

## Account Settings

1. Username, used as a subdomain for the URL
2. Beeminder access token
3. Timezone (needed to parse the deadlines; but less important since you have the chance to fix the deadline when creating the promise)

Later:

1. Pronoun (default "they/them/their/theirs")
2. Display name, e.g., "Alice" as opposed to username "alice"

## UI For Marking Promises Fulfilled

If Alice is logged in, the app lists her existing promises and lets her choose one of 
{not fulfilled yet, fulfilled on time, fulfilled partially or late} 
for each of them. 
Each defaults to "not fulfilled yet". 
If fulfilled partially, Alice specifies what percent fulfilled it was and/or when it was fulfilled.

Whenever anything about the promise changes it needs to be automatically mirrored in Beeminder.

We may also need an option to delete promises or mark them as voided.
We're not sure what should happen on Beeminder with a voided promise so we're just not going to
implement promise-voiding until there's demand for such a feature.

## Computing Statistics

The only statistics we'll care about initially are the number of promises Alice has made and her reliability percentage.
And how many pending vs past promises.

Definitions:

* `fill` &mdash; a promise's fulfilled fraction, between 0 to 1, default 0
* `tnow` &mdash; current unixtime
* `tdue` &mdash; promise's deadline

A promise's fulfilled fraction, `fill`, is 1 if fulfilled on time, or the specified percentage. 
If there's a fulfilled time specified then `fill` = the specified percentage (or 1 if not specified) times `credit(tfin-tnow)` where the credit function maps a number of seconds to how much credit you get if you're that much late (see lib/latepenalty.js).
For example, credit(0) is 1 (no penalty) and credit(3600) is 0.999 (most of the credit for being just an hour late).

We use a continuous late penalty function because it will be super cool to see the reliability percentage tick down in real time when one of Alice's deadlines passes.
(Dreev recommends React for that stuff.)

Finally, for the statistics, iterate through the promises, `p`, like so:

    if p is marked "not fulfilled yet" then
      if tnow<tfin then             # unfulfilled future promises don't
        waiting++                   #  count for or against you.
      else 
        numerator += credit(tnow-tfin) # optimistically assume I'm just
        denominator++                  #  about to fulfill the promise.
      end
    else                            # p is marked fulfilled or partially
      numerator += fill             #  fulfilled, whether or not it's
      denominator++                 #  past the deadline.
    end

That's it! 
Now you can report that the user has made 
{`denominator+waiting`} promises 
(of which {`waiting`} are still in the future) 
and has a reliability of 
{`numerator/denominator*100`}%.

## Automatically Creating Calendar Entries

It's pretty critical that the promises end up on your calendar.
That could be done semi-manually by creating links like described here: 
<https://stackoverflow.com/questions/10488831/link-to-add-to-google-calendar>  
No Calendar API needed that way -- just construct the link and if the user is logged in to Google it will create the calendar entry when they click it.


# Credits

Daniel Reeves wrote a blog post about the idea.
Sergii Kalinchuk got the "promises.to" domain.
Marcin Borkowski had the idea for URLs-as-UI for creating promises.
Chris Butler wrote much of the initial code.

<br>
<br>
<br>

## For Later: Ideas for parsing (that I mostly dislike)

1. **Magic spaces**:
   Whichever non-alphanumeric character is most common in the urtext, that's 
   what's assumed to be a space and is replaced with spaces before parsing.
2. **Less magical version**:
   A non-alphanumeric character must follow "alice.promises.to/" and that
   character is taken as the ersatz space. Eg:
   alice.promises.to/_start_her_promises_with_underscores
3. **Flexibility on the '/by/' part**:
   Requiring the string '/by/' to appear in the promise URL means no ambiguity
   about where to start parsing the deadline. But the Chrono parsing library 
   actually does great taking the whole string like "foo the bar by noon 
   tomorrow" and figuring out the time. We could also just take the last
   occurrence of "by" and parse everything after it as the deadline.

## For Later: Calendar as UI

Maybe it's not too much friction to just manually add entries to your calendar as the primary interface for adding promises. 
There are various ways to do that with very low friction already. 
But then that needs to automatically trigger promises.to to capture each calendar entry.
(I'm doing that now with IFTTT to send promises to Beeminder.)

And maybe it's fine for *every* calendar entry to get automatically added. 
Some of them won't be promises but that's fine -- you can just mark them as 
non-promises or delete them and they won't count. 
If they are promises then you need to manually mark them as fulfilled or not. 
Beeminder (plus the embarrassment of having your reliability percentage drop 
when a deadline passes) should suffice to make sure you remember to do that.

This is moot for now while we work on the URL-as-UI version.

## For Later: Security and Privacy

Alice's friends can troll her by making up URLs like 
alice.promises.to/kick_a_puppy 
but that's not a huge concern. 
Alice, when logged in, could have to approve promises to be public.
So the prankster would see a page that says Alice promises to kick a puppy 
but no one else would.

In the MVP we can skip the approval UI and worry about abuse like that the first time it's a problem, which I predict will be after promises.to is a million dollar company.

## For Later: Active vs Inactive Promises

It might be nice to reuse slugs!
Like to say bob.commits.to/call_mom/this_week and repeat that later and treat it as a new promise.

Half-baked idea for accomplishing that:

Define a promise to be inactive if its `tfin` and `tdue` dates are both non-null and in the past. 
(So even if a promise is done early it's still active till the due date, and even if it's overdue it's still active till it's done.
Or "done" -- it could be marked 0% fulfilled.)
If a URL is requested with slug foo and there exists a promise with slug foo but it's inactive, then ... 
never mind, I don't think this works!
(But maybe the notion of active vs inactive is useful for how promises are displayed.)

New plan is to just treat user/slug pairs as necessarily unique.
If you want to reuse a slug for a new promise it's up to you to rename (create a new slug for) the old promise first.

## Other domain name ideas

* dreev.es/will/ (for anyone who has a domain for their own name)
* alice.promises.to/ (sergii grabbed this one)
* alice.commits.to/ (dreev grabbed this one)
* alice.willdefinite.ly/ (kinda awkward)
* alice.willveri.ly/ (too cutesy?)
* alice.willprobab.ly/ (emphasizes the reliability percentage)
* alice.willresolute.ly (maybe it would grow on me?)

## Getting something dogfoodable as quickly as possible

1. parse incoming promises so all the fields are stored on GET
2. anything not parseable yields an error that the user sees when clicking on the URL
3. let you mark a promise fulfilled (or fractionally fulfilled, including 0%)
4. no privacy or security features; everything is public
5. no calendar API, just construct a link the user can click to create the calendar event
6. realtime reliability score!

